"use node";

import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../../_generated/server";
import { createGemini3Client, type Gemini3Client, type TokenUsage } from "../../lib/gemini3Client";
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

let cachedReviserClient: Gemini3Client | null = null;

function getReviserClient(): Gemini3Client {
  if (!cachedReviserClient) {
    cachedReviserClient = createGemini3Client({
      temperature: 0.6,
      maxOutputTokens: 16_000, // Sufficient for rewrites
      thinking_level: "medium",
      structured_outputs: true,
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      model: "google/gemini-3-pro-preview",
      fallbackModel: "openai/gpt-5-mini",
      stage: "reviser",
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
    costUsd: number;
    cacheHit: boolean;
    fallbackFrom?: string;
  };
}

interface ReviserParams {
  failing: CritiqueResult[];
  year: number;
  era: Era;
  llmClient?: Gemini3Client;
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
      llm: { requestId: "", model: "", usage: emptyUsage(), costUsd: 0, cacheHit: false },
    };
  }

  const client = params.llmClient ?? getReviserClient();
  let response;
  try {
    response = await client.generate({
      system: REVISER_SYSTEM_PROMPT,
      user: buildReviserUserPrompt(year, era, failing),
      schema: enforceArrayLength(failing.length),
      metadata: {
        stage: "reviser",
        year,
        era,
        failingCount: failing.length,
      },
      options: {
        thinking_level: "medium",
        structured_outputs: true,
        cache_system_prompt: true,
        cache_ttl_seconds: 86_400,
        maxOutputTokens: 16_000,
        temperature: 0.6,
        model: "google/gemini-3-pro-preview",
      },
    });
  } catch (error) {
    logStageError("Reviser", error, { year, era, failingCount: failing.length });
    throw error;
  }

  logStageSuccess("Reviser", "LLM call succeeded", {
    requestId: response.metadata.requestId,
    tokens: response.usage.totalTokens,
    year,
  });

  const rewrites = response.data.map(sanitizeEventRewrite);
  return {
    rewrites,
    llm: {
      requestId: response.metadata.requestId,
      model: response.metadata.model,
      usage: response.usage,
      costUsd: response.cost.totalUsd,
      cacheHit: response.metadata.cacheHit,
      fallbackFrom: response.metadata.fallbackFrom,
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

// Explicit helper ensures Zod narrowing for array length failures is surfaced early
function enforceArrayLength(count: number) {
  return z.array(CandidateEventSchema).length(count, { message: `expected ${count} rewrites` });
}
