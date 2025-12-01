"use node";

import { v } from "convex/values";
import { z } from "zod";
import { internalAction } from "../../_generated/server";
import { createGemini3Client, type Gemini3Client, type TokenUsage } from "../../lib/gemini3Client";
import { hasLeakage, hasProperNoun, isValidWordCount } from "../../lib/eventValidation";
import type { CandidateEvent, CritiqueResult } from "./schemas";
import { CritiqueResultSchema, parseEra, type Era } from "./schemas";
import { CandidateEventValue } from "./values";
import { logStageError, logStageSuccess } from "../../lib/logging";
import { QualityValidatorImpl } from "../../lib/qualityValidator";

const CRITIC_SYSTEM_PROMPT = `You are ChronBot Critic, a precision editor scoring historical event clues.

SCORING CRITERIA (0-1 scale):
- factual: Is this event real and accurately dated?
- leak_risk: Could this clue reveal the year? (0=no risk, 1=obvious giveaway)
- ambiguity: Could this event be confused with adjacent years?
- guessability: Does this help players infer the year? (0=useless, 1=perfect hint)
- diversity: Does this add topical/geographic variety to the set?

PASS THRESHOLDS:
- factual ≥0.75
- leak_risk ≤0.15
- ambiguity ≤0.25
- guessability ≥0.4

For failing events, provide BRIEF:
- issues: 1-2 words each (e.g., "year leak", "factual error")
- rewrite_hints: 3-5 words each (e.g., "remove century term", "add geographic context")

BE CONCISE. Keep arrays short.`;

const SCORE_THRESHOLDS = {
  factual: 0.75,
  leak_risk: 0.15,
  ambiguity: 0.25,
  guessability: 0.4,
} as const;

const ALLOWED_CATEGORIES = [
  "war",
  "politics",
  "science",
  "culture",
  "technology",
  "religion",
  "economy",
  "sports",
  "exploration",
  "arts",
];

let cachedCriticClient: Gemini3Client | null = null;
const qualityValidator = new QualityValidatorImpl();

function getCriticClient(): Gemini3Client {
  if (!cachedCriticClient) {
    cachedCriticClient = createGemini3Client({
      temperature: 0.2,
      maxOutputTokens: 32_000, // Generous for critique arrays
      thinking_level: "low", // Simple scoring doesn't need deep reasoning
      structured_outputs: true,
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      model: "google/gemini-3-flash-preview",
      fallbackModel: "openai/gpt-5-mini",
      stage: "critic",
    });
  }
  return cachedCriticClient;
}

export interface CriticActionResult {
  results: CritiqueResult[];
  llm: {
    requestId: string;
    model: string;
    usage: TokenUsage;
    costUsd: number;
    cacheHit: boolean;
    fallbackFrom?: string;
  };
  deterministicFailures: number;
}

interface CriticParams {
  year: number;
  era: Era;
  candidates: CandidateEvent[];
  llmClient?: Gemini3Client;
}

export const critiqueCandidates = internalAction({
  args: {
    year: v.number(),
    era: v.string(),
    candidates: v.array(CandidateEventValue),
  },
  handler: async (_ctx, args): Promise<CriticActionResult> => {
    const era = parseEra(args.era);
    return critiqueCandidatesForYear({
      year: args.year,
      era,
      candidates: args.candidates as CandidateEvent[],
    });
  },
});

export async function critiqueCandidatesForYear(params: CriticParams): Promise<CriticActionResult> {
  const { year, era, candidates } = params;
  if (!candidates.length) {
    return {
      results: [],
      llm: {
        requestId: "",
        model: "",
        usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 },
        costUsd: 0,
        cacheHit: false,
      },
      deterministicFailures: 0,
    };
  }

  const deterministic = runDeterministicChecks(candidates, year, era);
  const llmClient = params.llmClient ?? getCriticClient();
  let response;
  try {
    response = await llmClient.generate({
      system: CRITIC_SYSTEM_PROMPT,
      user: buildCriticUserPrompt(year, era, candidates),
      schema: zodArrayForCount(candidates.length),
      metadata: {
        stage: "critic",
        year,
        era,
      },
      options: {
        thinking_level: "low",
        structured_outputs: true,
        model: "google/gemini-3-flash-preview",
        cache_system_prompt: true,
        cache_ttl_seconds: 86_400,
        maxOutputTokens: 32_000,
        temperature: 0.2,
      },
    });
  } catch (error) {
    logStageError("Critic", error, { year, era, candidateCount: candidates.length });
    throw error;
  }

  logStageSuccess("Critic", "LLM call succeeded", {
    requestId: response.metadata.requestId,
    tokens: response.usage.totalTokens,
    year,
  });

  const llmResults = ensureArrayLength(response.data, candidates.length);
  const merged = await Promise.all(
    candidates.map(async (candidate, index) => {
      const validation = await qualityValidator.validateEvent({
        event_text: candidate.event_text,
        year,
        metadata: candidate.metadata,
      });

      return mergeCritiques(candidate, llmResults[index], deterministic[index], validation);
    }),
  );

  // Learn from rejected events with high semantic leakage
  for (const result of merged) {
    if (!result.passed && result.scores.leak_risk > 0.6) {
      qualityValidator.learnFromRejected(result.event.event_text, [year, year]);
    }
  }

  const deterministicFailures = deterministic.filter((item) => item.issues.length > 0).length;

  return {
    results: merged,
    llm: {
      requestId: response.metadata.requestId,
      model: response.metadata.model,
      usage: response.usage,
      costUsd: response.cost.totalUsd,
      cacheHit: response.metadata.cacheHit,
      fallbackFrom: response.metadata.fallbackFrom,
    },
    deterministicFailures,
  };
}

function buildCriticUserPrompt(year: number, era: Era, candidates: CandidateEvent[]): string {
  const payload = JSON.stringify(candidates, null, 2);
  return `Target year: ${Math.abs(year)} (${era})

Evaluate these candidate events for quality and year-leakage.

Candidates:
${payload}

CRITICAL: Your response MUST be a valid JSON array starting with [ and ending with ].
Return EXACTLY ${candidates.length} critique objects in this EXACT format:

[
  {
    "event": {
      "canonical_title": "...",
      "event_text": "...",
      "geo": "...",
      "difficulty_guess": 3,
      "confidence": 0.8,
      "leak_flags": { "has_digits": false, "has_century_terms": false, "has_spelled_year": false }
    },
    "passed": true,
    "scores": { "factual": 0.9, "leak_risk": 0.1, "ambiguity": 0.2, "guessability": 0.7, "diversity": 0.8 },
    "issues": [],
    "rewrite_hints": []
  }
]

BE CONCISE: issues/hints max 1-5 words each.`;
}

interface DeterministicCheckResult {
  issues: string[];
  rewriteHints: string[];
}

function runDeterministicChecks(
  candidates: CandidateEvent[],
  year: number,
  era: Era,
): DeterministicCheckResult[] {
  return candidates.map((candidate) => {
    const issues: string[] = [];
    const rewriteHints: string[] = [];

    if (
      candidate.leak_flags.has_digits ||
      candidate.leak_flags.has_century_terms ||
      candidate.leak_flags.has_spelled_year ||
      hasLeakage(candidate.event_text)
    ) {
      issues.push("Contains year leakage (numbers, century terms, or BCE/CE references)");
      rewriteHints.push("Remove numbers ≥10, century references, and BCE/CE terms");
    }

    if (!isValidWordCount(candidate.event_text, 20)) {
      issues.push("Exceeds 20-word limit");
      rewriteHints.push("Condense clue to 20 words or fewer");
    }

    if (!hasProperNoun(candidate.event_text)) {
      issues.push("Missing proper noun to anchor the clue");
      rewriteHints.push("Add a specific person, place, or institution");
    }

    const metadataResult = validateMetadata(candidate, year, era);
    issues.push(...metadataResult.issues);
    rewriteHints.push(...metadataResult.rewriteHints);

    return { issues, rewriteHints };
  });
}

function validateMetadata(
  candidate: CandidateEvent,
  year: number,
  _era: Era,
): DeterministicCheckResult {
  const issues: string[] = [];
  const rewriteHints: string[] = [];

  const metadata = candidate.metadata;
  if (!metadata) {
    issues.push("Missing metadata");
    rewriteHints.push("Add difficulty, category, era, fame_level, tags");
    return { issues, rewriteHints };
  }

  if (metadata.difficulty !== undefined && (metadata.difficulty < 1 || metadata.difficulty > 5)) {
    issues.push("Metadata difficulty out of range");
    rewriteHints.push("Set difficulty between 1 and 5");
  }

  if (metadata.fame_level !== undefined && (metadata.fame_level < 1 || metadata.fame_level > 5)) {
    issues.push("Metadata fame_level out of range");
    rewriteHints.push("Set fame_level between 1 and 5");
  }

  if (metadata.category && metadata.category.some((cat) => !ALLOWED_CATEGORIES.includes(cat))) {
    issues.push("Metadata category not in allowed list");
    rewriteHints.push("Use allowed categories only");
  }

  const expectedEra = categorizeEra(year);
  if (metadata.era && metadata.era !== expectedEra) {
    issues.push("Metadata era does not match year");
    rewriteHints.push(`Set era to ${expectedEra}`);
  }

  return { issues, rewriteHints };
}

function mergeCritiques(
  candidate: CandidateEvent,
  llmResult: CritiqueResult,
  deterministic: DeterministicCheckResult,
  validation: { passed: boolean; scores: { semantic_leakage: number }; suggestions?: string[] },
): CritiqueResult {
  const blendedScores = {
    ...llmResult.scores,
    leak_risk: clamp01(0.7 * llmResult.scores.leak_risk + 0.3 * validation.scores.semantic_leakage),
  };

  const threshold = enforceScoreThresholds(blendedScores);
  const combinedIssues = dedupeStrings([
    ...deterministic.issues,
    ...threshold.issues,
    ...(validation.passed ? [] : ["Validator flagged potential leakage"]),
    ...llmResult.issues,
  ]);
  const combinedHints = dedupeStrings([
    ...deterministic.rewriteHints,
    ...threshold.hints,
    ...(validation.suggestions ?? []),
    ...llmResult.rewrite_hints,
  ]);

  const passed =
    llmResult.passed && deterministic.issues.length === 0 && !threshold.failed && validation.passed;

  return {
    ...llmResult,
    event: candidate,
    scores: blendedScores,
    passed,
    issues: combinedIssues,
    rewrite_hints: combinedHints,
  };
}

interface ThresholdResult {
  issues: string[];
  hints: string[];
  failed: boolean;
}

function enforceScoreThresholds(scores: CritiqueResult["scores"]): ThresholdResult {
  const issues: string[] = [];
  const hints: string[] = [];
  let failed = false;

  if (scores.factual < SCORE_THRESHOLDS.factual) {
    failed = true;
    issues.push("Factual score below 0.75");
    hints.push("Verify the event date or choose a more verifiable clue");
  }
  if (scores.leak_risk > SCORE_THRESHOLDS.leak_risk) {
    failed = true;
    issues.push("Leak risk above 0.15");
    hints.push("Remove wording that directly reveals the year");
  }
  if (scores.ambiguity > SCORE_THRESHOLDS.ambiguity) {
    failed = true;
    issues.push("Ambiguity above 0.25");
    hints.push("Anchor the clue with details unique to the target year");
  }
  if (scores.guessability < SCORE_THRESHOLDS.guessability) {
    failed = true;
    issues.push("Guessability below 0.4");
    hints.push("Highlight why this year stands out compared to nearby years");
  }

  return { issues, hints, failed };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function categorizeEra(year: number): "ancient" | "medieval" | "modern" {
  if (year < 500) return "ancient";
  if (year < 1500) return "medieval";
  return "modern";
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function ensureArrayLength(results: CritiqueResult[], count: number): CritiqueResult[] {
  if (results.length === count) {
    return results;
  }
  if (results.length < count) {
    throw new Error(
      `Critic LLM returned ${results.length} results but ${count} candidates were provided`,
    );
  }
  return results.slice(0, count);
}

function zodArrayForCount(count: number) {
  return z.array(CritiqueResultSchema).length(count, { message: `expected ${count} results` });
}
