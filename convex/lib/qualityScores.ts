/**
 * Quality Score Computation Module
 *
 * Computes stable quality metrics per generation run for storage in generation_logs.
 * Used for 7-day trends, alerts, and admin dashboard. Deep debug lives in Langfuse.
 *
 * @module convex/lib/qualityScores
 */

import type { CritiqueResult, CandidateEvent } from "../actions/eventGeneration/schemas";

/**
 * Score vector from Critic evaluation.
 */
export interface ScoreVector {
  factual: number;
  leak_risk: number;
  ambiguity: number;
  guessability: number;
  diversity?: number;
}

/**
 * Durable quality scores stored per generation run.
 * Version field allows future schema evolution.
 */
export interface QualityScores {
  version: 1;
  candidateCount: number;
  passCount: number;
  selectedCount: number;
  /** Weighted composite score (0..1). Used for alerts and trends. */
  overall: number;
  /** Average scores across ALL candidates after final critique. */
  avg: ScoreVector;
  /** Average scores across SELECTED events only. */
  selectedAvg: ScoreVector;
}

/**
 * Weights for overall score computation.
 * overall = 0.35*factual + 0.35*guessability + 0.2*(1-leak_risk) + 0.1*(1-ambiguity)
 */
const WEIGHTS = {
  factual: 0.35,
  guessability: 0.35,
  leak_risk: 0.2, // inverted: (1 - leak_risk)
  ambiguity: 0.1, // inverted: (1 - ambiguity)
} as const;

/**
 * Computes quality scores from critic results and selected events.
 *
 * @param args.critiques - All critique results from final Critic pass
 * @param args.selected - Events selected for import (subset of passed critiques)
 * @returns QualityScores payload ready for storage
 */
export function computeQualityScores(args: {
  critiques: readonly CritiqueResult[];
  selected: readonly CandidateEvent[];
}): QualityScores {
  const { critiques, selected } = args;

  if (critiques.length === 0) {
    return emptyQualityScores();
  }

  const passCount = critiques.filter((c) => c.passed).length;
  const avg = computeAverageScores(critiques.map((c) => c.scores));

  // Match selected events back to critique scores by event_text
  const selectedScores = matchSelectedScores(critiques, selected);
  const selectedAvg = selectedScores.length > 0 ? computeAverageScores(selectedScores) : avg;

  // Overall uses selectedAvg (quality of what we're actually importing)
  const overall = computeOverallScore(selectedAvg);

  return {
    version: 1,
    candidateCount: critiques.length,
    passCount,
    selectedCount: selected.length,
    overall,
    avg,
    selectedAvg,
  };
}

/**
 * Computes average of score vectors.
 */
function computeAverageScores(scores: readonly ScoreVector[]): ScoreVector {
  if (scores.length === 0) {
    return { factual: 0, leak_risk: 0, ambiguity: 0, guessability: 0 };
  }

  const sum = scores.reduce(
    (acc, s) => ({
      factual: acc.factual + s.factual,
      leak_risk: acc.leak_risk + s.leak_risk,
      ambiguity: acc.ambiguity + s.ambiguity,
      guessability: acc.guessability + s.guessability,
      diversity: (acc.diversity ?? 0) + (s.diversity ?? 0),
    }),
    { factual: 0, leak_risk: 0, ambiguity: 0, guessability: 0, diversity: 0 },
  );

  const count = scores.length;
  const hasDiversity = scores.some((s) => s.diversity !== undefined);

  return {
    factual: sum.factual / count,
    leak_risk: sum.leak_risk / count,
    ambiguity: sum.ambiguity / count,
    guessability: sum.guessability / count,
    ...(hasDiversity ? { diversity: (sum.diversity ?? 0) / count } : {}),
  };
}

/**
 * Computes overall weighted score from score vector.
 * Formula: 0.35*factual + 0.35*guessability + 0.2*(1-leak_risk) + 0.1*(1-ambiguity)
 */
function computeOverallScore(scores: ScoreVector): number {
  const raw =
    WEIGHTS.factual * scores.factual +
    WEIGHTS.guessability * scores.guessability +
    WEIGHTS.leak_risk * (1 - scores.leak_risk) +
    WEIGHTS.ambiguity * (1 - scores.ambiguity);

  // Clamp to [0, 1] and round to 4 decimal places
  return Math.round(Math.max(0, Math.min(1, raw)) * 10000) / 10000;
}

/**
 * Matches selected events back to their critique scores.
 * Uses event_text as join key (brittle but sufficient for v1).
 */
function matchSelectedScores(
  critiques: readonly CritiqueResult[],
  selected: readonly CandidateEvent[],
): ScoreVector[] {
  const scoresByText = new Map<string, ScoreVector>();
  for (const critique of critiques) {
    scoresByText.set(critique.event.event_text, critique.scores);
  }

  return selected
    .map((event) => scoresByText.get(event.event_text))
    .filter((s): s is ScoreVector => s !== undefined);
}

/**
 * Returns empty quality scores for edge cases (no candidates).
 */
function emptyQualityScores(): QualityScores {
  return {
    version: 1,
    candidateCount: 0,
    passCount: 0,
    selectedCount: 0,
    overall: 0,
    avg: { factual: 0, leak_risk: 0, ambiguity: 0, guessability: 0 },
    selectedAvg: { factual: 0, leak_risk: 0, ambiguity: 0, guessability: 0 },
  };
}
