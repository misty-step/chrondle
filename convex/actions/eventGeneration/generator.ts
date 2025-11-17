"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import {
  createResponsesClient,
  type ResponsesClient,
  type TokenUsage,
} from "../../lib/responsesClient";
import type { CandidateEvent } from "./schemas";
import { GeneratorOutputSchema, parseEra, type Era } from "./schemas";
import { logStageError, logStageSuccess } from "../../lib/logging";

const GENERATOR_SYSTEM_PROMPT = `You are ChronBot Generator, a historian-puzzlemaker creating historical event clues for a guessing game.

CRITICAL RULES:
1. All events MUST be from the EXACT target year provided
2. NO numerals ≥10 (write "twelve" not "12", "thousand" not "1000")
3. NO century/decade/millennium terms ("19th century" forbidden)
4. NO BCE/CE/AD/BC terminology
5. Present tense, ≤20 words per event
6. Include proper nouns (people, places, institutions)
7. Vary topics: mix politics, science, culture, technology, sports, economy, war, religion, exploration
8. Vary geography: include multiple regions and countries - not all Western events

OUTPUT: Valid JSON matching the schema. 12-18 diverse candidates.

SPECIAL HANDLING FOR ANCIENT YEARS (1-3 digits):
- Prefer figure-centric clues: "Caesar falls at Theatre of Pompey"
- Avoid era terms: "late Republic" acceptable, "1st century BCE" forbidden
- Use dynasties, rulers, cultural movements without date indicators

DIVERSITY GUIDANCE:
Balance your event selection across different spheres of human activity and different parts of the world.
If the year has limited documented events, focus on what IS known rather than forcing artificial diversity.`;

let cachedGeneratorClient: ResponsesClient | null = null;

function getGeneratorClient(): ResponsesClient {
  if (!cachedGeneratorClient) {
    cachedGeneratorClient = createResponsesClient({
      temperature: 0.8,
      maxOutputTokens: 32_000, // Generous for 12-18 events
      reasoning: {
        effort: "medium", // Quality reasoning for historical accuracy
      },
      text: {
        verbosity: "medium", // Natural, detailed JSON output
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
  return cachedGeneratorClient;
}

export interface GeneratorYearSummary {
  value: number;
  era: Era;
  digits: number;
}

export interface GeneratorActionResult {
  year: GeneratorYearSummary;
  candidates: CandidateEvent[];
  llm: {
    requestId: string;
    model: string;
    usage: TokenUsage;
  };
}

interface GenerateCandidatesParams {
  year: number;
  era: Era;
  llmClient?: ResponsesClient;
}

export const generateCandidates = internalAction({
  args: {
    year: v.number(),
    era: v.string(),
  },
  handler: async (_ctx, args): Promise<GeneratorActionResult> => {
    const era = parseEra(args.era);
    return generateCandidatesForYear({ year: args.year, era });
  },
});

export async function generateCandidatesForYear(
  params: GenerateCandidatesParams,
): Promise<GeneratorActionResult> {
  const { year, era } = params;
  const client = params.llmClient ?? getGeneratorClient();
  const yearSummary: GeneratorYearSummary = {
    value: year,
    era,
    digits: Math.min(4, Math.max(1, getDigitCount(year))),
  };

  const response = await client.generate({
    prompt: {
      system: GENERATOR_SYSTEM_PROMPT,
      user: buildGeneratorUserPrompt(year, era),
    },
    schema: GeneratorOutputSchema,
    metadata: {
      stage: "generator",
      year,
      era,
    },
  });

  warnIfYearMismatch(
    response.data.year.value,
    year,
    response.data.year.era,
    era,
    response.requestId,
  );

  logStageSuccess("Generator", "LLM call succeeded", {
    requestId: response.requestId,
    model: response.model,
    tokens: response.usage.totalTokens,
    year,
  });

  const candidates = response.data.candidates.map(sanitizeCandidateEvent);

  return {
    year: yearSummary,
    candidates,
    llm: {
      requestId: response.requestId,
      model: response.model,
      usage: response.usage,
    },
  };
}

function buildGeneratorUserPrompt(year: number, era: Era): string {
  const absoluteYear = Math.abs(year);
  const yearLabel = era === "BCE" ? absoluteYear : year;
  const digitCount = Math.min(4, Math.max(1, getDigitCount(year)));

  return `Target year: ${yearLabel} (${era})

Generate 12-18 historical events that occurred in ${yearLabel} ${era}.

Requirements:
- All events from ${yearLabel} exactly
- Present tense, ≤20 words
- No year leakage (no numbers ≥10, no century terms)
- Topical diversity (mix politics, science, culture, technology, sports, economy, war, religion, exploration)
- Geographic diversity (multiple regions - not all Western)
- Difficulty range: mix of obscure (1-2) and recognizable (4-5)

Return JSON in this EXACT format:
{
  "year": {
    "value": ${year},
    "era": "${era}",
    "digits": ${digitCount}
  },
  "candidates": [
    {
      "canonical_title": "Brief title",
      "event_text": "Present tense description under 20 words",
      "geo": "Geographic region or country",
      "difficulty_guess": 3, // Integer from 1 to 5
      "confidence": 0.8, // Float from 0.0 to 1.0
      "leak_flags": {
        "has_digits": false,
        "has_century_terms": false,
        "has_spelled_year": false
      }
    }
  ]
}`;
}

function sanitizeCandidateEvent(candidate: CandidateEvent): CandidateEvent {
  return {
    ...candidate,
    canonical_title: candidate.canonical_title.trim(),
    event_text: normalizeWhitespace(candidate.event_text),
    geo: candidate.geo.trim(),
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getDigitCount(year: number): number {
  const absolute = Math.abs(Math.trunc(year)) || 0;
  return String(absolute === 0 ? 0 : absolute).length;
}

function warnIfYearMismatch(
  llmYear: number,
  requestedYear: number,
  llmEra: Era,
  requestedEra: Era,
  requestId: string,
): void {
  if (llmYear === requestedYear && llmEra === requestedEra) {
    return;
  }

  logStageError("Generator", new Error("LLM year mismatch"), {
    requestId,
    expectedYear: requestedYear,
    expectedEra: requestedEra,
    llmYear,
    llmEra,
  });
}
