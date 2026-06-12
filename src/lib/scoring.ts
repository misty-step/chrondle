import { HintCount, ScoreResult } from "../types/range";

export const SCORING_CONSTANTS = {
  W_MAX: 250,
  // Minimum width factor floor: ensures maximum-width ranges earn at least 4% of max score
  MIN_WIDTH_FACTOR_FLOOR: 0.04,
  // Flat deduction scoring: max possible score at each hint level (0-6 hints)
  // Costs: 0 hints=100pts, -15pts, -15pts, -15pts, -10pts, -10pts, -10pts
  // Cumulative max scores: [100, 85, 70, 55, 45, 35, 25]
  MAX_SCORES_BY_HINTS: [100, 85, 70, 55, 45, 35, 25] as const,
  // Individual hint costs for display purposes
  HINT_COSTS: [15, 15, 15, 10, 10, 10] as const,
} as const;

const { MAX_SCORES_BY_HINTS } = SCORING_CONSTANTS;

const HINT_LEVELS = new Set<HintCount>([0, 1, 2, 3, 4, 5, 6]);

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function validateInputs(
  start: number,
  end: number,
  answer: number,
  tolerance: number,
  hintsUsed: HintCount,
): void {
  const numericArgs: Array<[number, string]> = [
    [start, "start"],
    [end, "end"],
    [answer, "answer"],
    [tolerance, "tolerance"],
  ];

  numericArgs.forEach(([value, label]) => {
    assertFinite(value, label);
  });

  if (tolerance < 0) {
    throw new Error("tolerance cannot be negative");
  }

  if (!HINT_LEVELS.has(hintsUsed)) {
    throw new Error("hintsUsed must be between 0 and 6 inclusive");
  }
}

function calculateWidth(start: number, end: number): number {
  const width = end - start + 1;

  if (width <= 0) {
    throw new Error("start year must be less than or equal to end year");
  }

  if (width > SCORING_CONSTANTS.W_MAX) {
    throw new Error(`range width cannot exceed ${SCORING_CONSTANTS.W_MAX} years`);
  }

  return width;
}

/**
 * Detailed score calculation with containment metadata.
 *
 * Scoring system:
 * - Base: 100 points maximum (for 1-year range, 0 hints)
 * - Width penalty: Quadratic interpolation from 100% (1-year) to 4% (W_MAX-year range)
 * - Hint costs: Flat deductions of 15, 15, 15, 10, 10, 10 points
 * - Final: max_score_for_hints * width_factor, rounded down
 * - Minimum floor: Even maximum-width ranges earn 4% of max score for hint tier
 */
export function scoreRangeDetailed(
  start: number,
  end: number,
  answer: number,
  tolerance: number = 0,
  hintsUsed: HintCount = 0,
): ScoreResult {
  validateInputs(start, end, answer, tolerance, hintsUsed);
  const width = calculateWidth(start, end);

  const lowerBound = start - tolerance;
  const upperBound = end + tolerance;
  const contains = answer >= lowerBound && answer <= upperBound;

  if (!contains) {
    return {
      score: 0,
      contained: false,
      baseScore: 0,
      width,
    };
  }

  // Flat deduction scoring: max score for the hint tier, scaled by the
  // quadratic width factor. The math lives in computeScoreBreakdown so the
  // in-game explanations can never drift from the real curve.
  const breakdown = computeScoreBreakdown(start, end, hintsUsed);

  return {
    score: breakdown.potentialScore,
    contained: true,
    baseScore: breakdown.cappedScore * breakdown.widthFactor,
    width,
  };
}

/**
 * Public scoring helper that returns just the final integer score.
 */
export function scoreRange(
  start: number,
  end: number,
  answer: number,
  tolerance: number = 0,
  hintsUsed: HintCount = 0,
): number {
  return scoreRangeDetailed(start, end, answer, tolerance, hintsUsed).score;
}

export interface ScoreBreakdown {
  /** Maximum possible score with zero hints and a 1-year range */
  basePotential: number;
  hintsUsed: HintCount;
  /** Points lost to hints: basePotential - cappedScore */
  hintPenalty: number;
  /** Maximum score at this hint level before the width factor */
  cappedScore: number;
  width: number;
  /** Quadratic width factor in [MIN_WIDTH_FACTOR_FLOOR, 1] */
  widthFactor: number;
  /**
   * Points this range earns IF it contains the answer:
   * floor(cappedScore * widthFactor). Matches scoreRange exactly.
   */
  potentialScore: number;
}

/**
 * Explains the score a range would earn if it contained the answer.
 *
 * This is the same math as scoreRangeDetailed with containment assumed —
 * used for the live "worth N pts" preview while picking a range and for the
 * post-game breakdown. Keeping it here guarantees the explanation can never
 * drift from the actual scoring curve.
 */
export function computeScoreBreakdown(
  start: number,
  end: number,
  hintsUsed: HintCount = 0,
): ScoreBreakdown {
  validateInputs(start, end, 0, 0, hintsUsed);
  const width = calculateWidth(start, end);

  const basePotential = MAX_SCORES_BY_HINTS[0];
  const cappedScore = MAX_SCORES_BY_HINTS[hintsUsed];

  const minFloor = SCORING_CONSTANTS.MIN_WIDTH_FACTOR_FLOOR;
  const progress = Math.pow((width - 1) / (SCORING_CONSTANTS.W_MAX - 1), 2);
  const widthFactor = 1 - progress * (1 - minFloor);

  return {
    basePotential,
    hintsUsed,
    hintPenalty: basePotential - cappedScore,
    cappedScore,
    width,
    widthFactor,
    potentialScore: Math.floor(cappedScore * widthFactor),
  };
}
