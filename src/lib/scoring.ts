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

  // New flat deduction scoring system:
  // 1. Get max possible score based on hints used
  // 2. Scale by range width (narrower = better), ensuring a minimum floor (5%)
  // 3. Round down to integer
  const maxScoreForHints = MAX_SCORES_BY_HINTS[hintsUsed];

  const minFloor = SCORING_CONSTANTS.MIN_WIDTH_FACTOR_FLOOR;
  // Progress from 0.0 (width 1) to 1.0 (width W_MAX), squared for quadratic curve
  const progress = Math.pow((width - 1) / (SCORING_CONSTANTS.W_MAX - 1), 2);
  // Quadratic interpolation: gentle slope in playable range, steep at extremes
  const widthFactor = 1 - progress * (1 - minFloor);

  const baseScore = maxScoreForHints * widthFactor;
  const score = Math.floor(baseScore);

  return {
    score,
    contained: true,
    baseScore,
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
