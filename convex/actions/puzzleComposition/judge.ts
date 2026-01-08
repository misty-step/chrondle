"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { createGemini3Client, type Gemini3Client, type TokenUsage } from "../../lib/gemini3Client";
import { logStageError, logStageSuccess } from "../../lib/logging";
import { PuzzleJudgmentSchema, type PuzzleJudgment, type PuzzleJudgeInput } from "./schemas";

const JUDGE_SYSTEM_PROMPT = `You are ChronBot Puzzle Judge, evaluating whether a set of 6 historical event clues makes a high-quality Chrondle puzzle.

CHRONDLE GAME RULES:
- Players guess a historical year based on event clues
- Hints are revealed one at a time (Hint 1 first, then 2, 3, 4, 5, 6)
- Players should be able to guess correctly by hint 4-6

PUZZLE QUALITY CRITERIA:

1. DIFFICULTY GRADIENT (Hard → Easy)
   - Hint 1: Obscure, requires deep history knowledge
   - Hints 2-5: Progressively more famous/recognizable
   - Hint 6: "Clincher" - iconic event most people know
   Score 1.0 if gradient is perfect, 0.0 if inverted

2. TOPIC DIVERSITY
   - Mix topics: war, politics, science, culture, sports, technology, economy, religion, arts
   - Avoid 3+ clues from same domain
   Score 1.0 if well-mixed, 0.0 if all same topic

3. GEOGRAPHIC SPREAD
   - Include events from multiple regions (Europe, Americas, Asia, Africa, Middle East)
   - Avoid Western-only or single-region puzzles
   Score 1.0 if global, 0.0 if single region

4. GUESSABILITY
   - By hint 4-6, a history enthusiast should deduce the year
   - Events should collectively "point" to the target year
   Score 1.0 if clearly guessable, 0.0 if impossible

APPROVAL THRESHOLD:
- qualityScore ≥ 0.6 to approve
- All composition scores ≥ 0.4

OUTPUT FORMAT:
Return a JSON object with:
- approved: boolean (true if meets thresholds)
- qualityScore: 0-1 (weighted average of composition scores)
- ordering.recommended: array of 6 event texts, ordered HARD → EASY
- ordering.rationale: brief explanation of ordering
- composition: { topicDiversity, geographicSpread, difficultyGradient, guessability } (0-1 each)
- issues: array of brief problems (if any)
- suggestions: array of brief improvements (if any)

BE CONCISE. Keep issues/suggestions to 1-5 words each.`;

// Weights for computing overall quality score
const QUALITY_WEIGHTS = {
  topicDiversity: 0.2,
  geographicSpread: 0.2,
  difficultyGradient: 0.3,
  guessability: 0.3,
} as const;

const APPROVAL_THRESHOLD = 0.6;
const MIN_COMPONENT_SCORE = 0.4;

let cachedJudgeClient: Gemini3Client | null = null;

function getJudgeClient(): Gemini3Client {
  if (!cachedJudgeClient) {
    cachedJudgeClient = createGemini3Client({
      temperature: 0.3, // Slightly creative for ordering decisions
      maxOutputTokens: 4_000, // Modest output for single puzzle
      thinking_level: "medium", // Needs some reasoning for ordering
      structured_outputs: true,
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      model: "google/gemini-3-flash-preview",
      fallbackModel: "openai/gpt-5-mini",
      stage: "puzzle-judge",
    });
  }
  return cachedJudgeClient;
}

export interface JudgeActionResult {
  judgment: PuzzleJudgment;
  llm: {
    requestId: string;
    model: string;
    usage: TokenUsage;
    costUsd: number;
    cacheHit: boolean;
    fallbackFrom?: string;
  };
}

interface JudgeParams {
  year: number;
  era: "BCE" | "CE";
  events: string[];
  llmClient?: Gemini3Client;
}

/**
 * Convex action to judge a puzzle composition
 */
export const judgePuzzle = internalAction({
  args: {
    year: v.number(),
    era: v.string(),
    events: v.array(v.string()),
  },
  handler: async (_ctx, args): Promise<JudgeActionResult> => {
    const era = args.era.toUpperCase() as "BCE" | "CE";
    if (era !== "BCE" && era !== "CE") {
      throw new Error(`Invalid era: ${args.era}`);
    }
    return judgePuzzleComposition({
      year: args.year,
      era,
      events: args.events,
    });
  },
});

/**
 * Core puzzle judgment logic - can be called directly or via action
 */
export async function judgePuzzleComposition(params: JudgeParams): Promise<JudgeActionResult> {
  const { year, era, events } = params;

  if (events.length < 6) {
    throw new Error(`Need at least 6 events, got ${events.length}`);
  }

  const llmClient = params.llmClient ?? getJudgeClient();
  let response;

  try {
    response = await llmClient.generate({
      system: JUDGE_SYSTEM_PROMPT,
      user: buildJudgeUserPrompt(year, era, events),
      schema: PuzzleJudgmentSchema,
      metadata: {
        stage: "puzzle-judge",
        year,
        era,
      },
      options: {
        thinking_level: "medium",
        structured_outputs: true,
        model: "google/gemini-3-flash-preview",
        cache_system_prompt: true,
        cache_ttl_seconds: 86_400,
        maxOutputTokens: 4_000,
        temperature: 0.3,
      },
    });
  } catch (error) {
    logStageError("PuzzleJudge", error, { year, era, eventCount: events.length });
    throw error;
  }

  logStageSuccess("PuzzleJudge", "LLM call succeeded", {
    requestId: response.metadata.requestId,
    tokens: response.usage.totalTokens,
    year,
    approved: response.data.approved,
    qualityScore: response.data.qualityScore,
  });

  // Validate and potentially override approval based on thresholds
  const judgment = enforceApprovalThresholds(response.data);

  return {
    judgment,
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

function buildJudgeUserPrompt(year: number, era: "BCE" | "CE", events: string[]): string {
  const eventList = events.map((e, i) => `${i + 1}. ${e}`).join("\n");

  return `Target year: ${Math.abs(year)} ${era}

Evaluate this puzzle and reorder the events from HARDEST to EASIEST:

${eventList}

IMPORTANT:
1. Return the events in your recommended order (hard → easy)
2. Use the EXACT event text from the input
3. Score each composition dimension 0-1
4. Approve only if qualityScore ≥ 0.6 and all components ≥ 0.4`;
}

/**
 * Enforce approval thresholds - may override LLM's approval decision
 */
function enforceApprovalThresholds(judgment: PuzzleJudgment): PuzzleJudgment {
  const { composition } = judgment;

  // Recompute quality score from weights for consistency
  const computedScore =
    QUALITY_WEIGHTS.topicDiversity * composition.topicDiversity +
    QUALITY_WEIGHTS.geographicSpread * composition.geographicSpread +
    QUALITY_WEIGHTS.difficultyGradient * composition.difficultyGradient +
    QUALITY_WEIGHTS.guessability * composition.guessability;

  // Check all thresholds
  const meetsOverallThreshold = computedScore >= APPROVAL_THRESHOLD;
  const meetsComponentThresholds =
    composition.topicDiversity >= MIN_COMPONENT_SCORE &&
    composition.geographicSpread >= MIN_COMPONENT_SCORE &&
    composition.difficultyGradient >= MIN_COMPONENT_SCORE &&
    composition.guessability >= MIN_COMPONENT_SCORE;

  const shouldApprove = meetsOverallThreshold && meetsComponentThresholds;

  // Add issues if we're overriding
  const issues = [...judgment.issues];
  if (judgment.approved && !shouldApprove) {
    if (!meetsOverallThreshold) {
      issues.push(`Quality score ${computedScore.toFixed(2)} below 0.6 threshold`);
    }
    if (!meetsComponentThresholds) {
      const lowComponents = [];
      if (composition.topicDiversity < MIN_COMPONENT_SCORE) lowComponents.push("topicDiversity");
      if (composition.geographicSpread < MIN_COMPONENT_SCORE)
        lowComponents.push("geographicSpread");
      if (composition.difficultyGradient < MIN_COMPONENT_SCORE)
        lowComponents.push("difficultyGradient");
      if (composition.guessability < MIN_COMPONENT_SCORE) lowComponents.push("guessability");
      issues.push(`Low scores: ${lowComponents.join(", ")}`);
    }
  }

  return {
    ...judgment,
    qualityScore: Number(computedScore.toFixed(3)),
    approved: shouldApprove,
    issues,
  };
}

/**
 * Validate input before calling judge
 */
export function validateJudgeInput(input: PuzzleJudgeInput): void {
  if (input.events.length < 6) {
    throw new Error(`Need at least 6 events for a puzzle, got ${input.events.length}`);
  }
  if (input.era !== "BCE" && input.era !== "CE") {
    throw new Error(`Invalid era: ${input.era}`);
  }
}
