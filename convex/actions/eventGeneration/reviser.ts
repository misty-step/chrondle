"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import {
  createResponsesClient,
  type ResponsesClient,
  type TokenUsage,
} from "../../lib/responsesClient";
import type { CandidateEvent, CritiqueResult } from "./schemas";
import { CandidateEventSchema, parseEra, type Era } from "./schemas";
import { CandidateEventValue } from "./values";
import { logStageError, logStageSuccess } from "../../lib/logging";

const REVISER_SYSTEM_PROMPT = `You are ChronBot Reviser. Rewrite ONLY failing events using critic feedback.

MAINTAIN ALL CONSTRAINTS:
- Present tense, ≤20 words
- No numerals ≥10, no century/decade/BCE/CE terms
- Include proper nouns
- Target year: {{year}} ({{era}})

REWRITING STRATEGIES:
- Remove specific dates/numbers: "Napoleon crowned" not "Napoleon crowned in 1804"
- Add proper nouns: "Paris" not "the capital"
- Vary phrasing: Use different verbs, frame differently
- Preserve core event: Keep the historical fact, change the clue wording

OUTPUT: Valid JSON with rewritten events.`;

let cachedReviserClient: ResponsesClient | null = null;

function getReviserClient(): ResponsesClient {
  if (!cachedReviserClient) {
    cachedReviserClient = createResponsesClient({
      temperature: 0.6,
      maxOutputTokens: 16_000, // Sufficient for rewrites
      reasoning: {
        effort: "medium", // Quality rewrites need reasoning
      },
      text: {
        verbosity: "medium", // Natural rewrites
      },
      pricing: {
        "openai/gpt-5-mini": {
          inputCostPer1K: 0.15,
          outputCostPer1K: 0.6,
          reasoningCostPer1K: 0.15,
        },
      },
    });
  }
  return cachedReviserClient;
}

export interface ReviserActionResult {
  rewrites: CandidateEvent[];
  llm: {
    requestId: string;
    model: string;
    usage: TokenUsage;
  };
}

interface ReviserParams {
  failing: CritiqueResult[];
  year: number;
  era: Era;
  llmClient?: ResponsesClient;
}

export const reviseCandidates = internalAction({
  args: {
    failing: v.array(
      v.object({
        event: CandidateEventValue,
        issues: v.array(v.string()),
        rewrite_hints: v.array(v.string()),
      }),
    ),
    year: v.number(),
    era: v.string(),
  },
  handler: async (_ctx, args): Promise<ReviserActionResult> => {
    const era = parseEra(args.era);
    return reviseCandidatesForYear({
      failing: args.failing as CritiqueResult[],
      year: args.year,
      era,
    });
  },
});

export async function reviseCandidatesForYear(params: ReviserParams): Promise<ReviserActionResult> {
  const { failing, year, era } = params;
  if (!failing.length) {
    return {
      rewrites: [],
      llm: { requestId: "", model: "", usage: emptyUsage() },
    };
  }

  const client = params.llmClient ?? getReviserClient();
  let response;
  try {
    response = await client.generate({
      prompt: {
        system: REVISER_SYSTEM_PROMPT,
        user: buildReviserUserPrompt(year, era, failing),
      },
      schema: CandidateEventSchema.array().length(failing.length),
      jsonFormat: "array", // Allow array at root level
      metadata: {
        stage: "reviser",
        year,
        era,
        failingCount: failing.length,
      },
    });
  } catch (error) {
    logStageError("Reviser", error, { year, era, failingCount: failing.length });
    throw error;
  }

  logStageSuccess("Reviser", "LLM call succeeded", {
    requestId: response.requestId,
    tokens: response.usage.totalTokens,
    year,
  });

  const rewrites = response.data.map(sanitizeEventRewrite);
  return {
    rewrites,
    llm: {
      requestId: response.requestId,
      model: response.model,
      usage: response.usage,
    },
  };
}

function buildReviserUserPrompt(
  year: number,
  era: Era,
  failing: Pick<CritiqueResult, "event" | "rewrite_hints">[],
): string {
  const payload = JSON.stringify(
    failing.map((failure) => ({
      event: failure.event,
      hints: failure.rewrite_hints,
    })),
    null,
    2,
  );

  return `Target year: ${Math.abs(year)} (${era})

Rewrite these failing events using the critic's hints.

Failing events:
${payload}

CRITICAL: Your response MUST be a valid JSON array starting with [ and ending with ].
Return EXACTLY ${failing.length} rewritten events in this EXACT format.

[
  {
    "canonical_title": "Brief title",
    "event_text": "Improved clue text",
    "geo": "Geographic location",
    "difficulty_guess": 3,
    "confidence": 0.8,
    "leak_flags": { "has_digits": false, "has_century_terms": false, "has_spelled_year": false }
  }
]`;
}

function sanitizeEventRewrite(event: CandidateEvent): CandidateEvent {
  return {
    ...event,
    canonical_title: event.canonical_title.trim(),
    event_text: event.event_text.replace(/\s+/g, " ").trim(),
    geo: event.geo.trim(),
  };
}

function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}
