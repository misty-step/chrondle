"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { createGemini3Client, type Gemini3Client, type TokenUsage } from "../../lib/gemini3Client";
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

let cachedGeneratorClient: Gemini3Client | null = null;

function getGeneratorClient(): Gemini3Client {
  if (!cachedGeneratorClient) {
    cachedGeneratorClient = createGemini3Client({
      temperature: 0.8,
      maxOutputTokens: 32_000, // Generous for 12-18 events
      thinking_level: "high", // Creativity + reasoning
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      structured_outputs: true,
      model: "google/gemini-3-pro-preview",
      fallbackModel: "openai/gpt-5-mini",
      stage: "generator",
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
    costUsd: number;
    cacheHit: boolean;
    fallbackFrom?: string;
  };
}

interface GenerateCandidatesParams {
  year: number;
  era: Era;
  llmClient?: Gemini3Client;
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
    system: GENERATOR_SYSTEM_PROMPT,
    user: buildGeneratorUserPrompt(year, era),
    schema: GeneratorOutputSchema,
    metadata: {
      stage: "generator",
      year,
      era,
    },
    options: {
      thinking_level: "high",
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      maxOutputTokens: 32_000,
      temperature: 0.8,
      structured_outputs: true,
      model: "google/gemini-3-pro-preview",
    },
  });

  warnIfYearMismatch(
    response.data.year.value,
    year,
    response.data.year.era,
    era,
    response.metadata.requestId,
  );

  logStageSuccess("Generator", "LLM call succeeded", {
    requestId: response.metadata.requestId,
    model: response.metadata.model,
    tokens: response.usage.totalTokens,
    year,
  });

  const candidates = response.data.candidates.map(sanitizeCandidateEvent);

  return {
    year: yearSummary,
    candidates,
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

/**
 * Builds enhanced prompt guidance for sparse years (ancient, BC, obscure modern).
 * Provides historical context to improve generation success rate.
 *
 * @param year - Target year (negative for BCE)
 * @param era - Era classification ("BCE" or "CE")
 * @param digits - Number of digits in the year (1-4)
 * @returns Additional context string or empty if not needed
 */
function buildEnhancedPrompt(year: number, era: Era, digits: number): string {
  const absoluteYear = Math.abs(year);

  // Ancient years (1-2 digits): Add historical context primer
  if (digits <= 2 && era === "CE") {
    const contexts = [
      "Context: Early Roman Empire period. Focus on emperors, dynasties, and major figures.",
      "Possible figures: Emperors (Augustus, Tiberius, Nero, Vespasian, Trajan), philosophers, military leaders.",
      "Cultural movements: Early Christianity, Roman architecture, Silk Road trade.",
      "Prefer figure-centric events: 'Emperor X ascends throne' rather than 'Rome experiences change'.",
    ];
    return "\n\n" + contexts.join("\n");
  }

  // BCE years: Enforce figure-centric approach
  if (era === "BCE") {
    const bcContexts = [
      "Context: Ancient world - emphasize specific figures and dynasties.",
      "Structure events around people: 'Caesar conquers Gaul' NOT 'Rome expands territory'.",
      "Key civilizations: Egypt (pharaohs, dynasties), Greece (philosophers, city-states), Rome (consuls, generals), Persia (kings), China (dynasties, emperors).",
      "Avoid passive constructions - use active voice with named individuals.",
    ];

    // Add specific dynasty/ruler context for different BCE periods
    // Note: In BCE, larger numbers = earlier times (300 BCE is earlier than 30 BCE)
    if (absoluteYear >= 30 && absoluteYear <= 300) {
      bcContexts.push(
        "Hellenistic period: Alexander's successors, Ptolemies, Seleucids, Roman Republic expansion.",
      );
    } else if (absoluteYear > 300 && absoluteYear <= 500) {
      bcContexts.push(
        "Classical period: Greek city-states, Persian Empire, Roman Republic early phase, Warring States (China).",
      );
    } else if (absoluteYear > 500) {
      bcContexts.push(
        "Early civilizations: Bronze Age, early dynasties, formation of major cultural centers.",
      );
    }

    return "\n\n" + bcContexts.join("\n");
  }

  // Obscure modern years (sparse documentation periods): Provide decade context
  // Years 1500-1700 CE tend to have sparse documentation outside major European events
  if (era === "CE" && year >= 1500 && year <= 1700 && digits === 4) {
    const decadeContexts = [
      "Context: Early modern period - Renaissance, Reformation, Age of Exploration.",
      "Major contemporaries: Consider events in Europe, Ottoman Empire, Ming/Qing China, Mughal India, Aztec/Inca empires.",
      "Topics: Religious conflicts, voyages of exploration, scientific discoveries, artistic movements, dynastic changes.",
      "If documentation is limited, prioritize known figures and major political changes over mundane events.",
    ];
    return "\n\n" + decadeContexts.join("\n");
  }

  // No enhancement needed for well-documented modern years (1700+)
  return "";
}

function buildGeneratorUserPrompt(year: number, era: Era): string {
  const absoluteYear = Math.abs(year);
  const yearLabel = era === "BCE" ? absoluteYear : year;
  const digitCount = Math.min(4, Math.max(1, getDigitCount(year)));
  const enhancedContext = buildEnhancedPrompt(year, era, digitCount);

  return `Target year: ${yearLabel} (${era})${enhancedContext}

Generate 12-18 historical events that occurred in ${yearLabel} ${era}.

Requirements:
- All events from ${yearLabel} exactly
- Present tense, ≤20 words
- No year leakage (no numbers ≥10, no century terms)
- Topical diversity (mix politics, science, culture, technology, sports, economy, war, religion, exploration)
- Geographic diversity (multiple regions - not all Western)
- Difficulty range: mix of obscure (1-2) and recognizable (4-5)
- For each event, estimate metadata:
  - difficulty (1-5)
  - category array (e.g., ["war", "politics", "science", "culture", "technology", "religion", "economy", "sports", "exploration", "arts"])
  - era bucket: "ancient" (<500 CE), "medieval" (500-1500 CE), "modern" (1500+ CE)
  - fame_level (1-5) how well-known the event is
  - tags: free-form strings (2-5 short tags)

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
      },
      "metadata": {
        "difficulty": 3,
        "category": ["politics", "science"],
        "era": "modern",
        "fame_level": 4,
        "tags": ["industrial", "europe"]
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
