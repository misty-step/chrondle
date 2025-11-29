import type {
  AttemptScore,
  OrderAttempt,
  OrderEvent,
  PositionFeedback,
} from "@/types/orderGameState";

// =============================================================================
// Core Scoring Functions
// =============================================================================

/**
 * Evaluates a player's ordering against the correct chronological order.
 * Returns detailed feedback for each position.
 *
 * This is a pure function - the core of the scoring system.
 *
 * @param ordering - Player's submitted event order (array of event IDs)
 * @param events - Puzzle events with year information
 * @returns Attempt record with feedback
 */
export function evaluateOrdering(
  ordering: string[],
  events: OrderEvent[],
): Omit<OrderAttempt, "timestamp"> {
  const correctOrder = getCorrectOrder(events);
  const feedback = computePositionFeedback(ordering, correctOrder);
  const { correct: pairsCorrect, total: totalPairs } = countCorrectPairs(ordering, correctOrder);

  return {
    ordering,
    feedback,
    pairsCorrect,
    totalPairs,
  };
}

/**
 * Creates a complete attempt record with timestamp.
 */
export function createAttempt(ordering: string[], events: OrderEvent[]): OrderAttempt {
  return {
    ...evaluateOrdering(ordering, events),
    timestamp: Date.now(),
  };
}

/**
 * Checks if an attempt represents a solved puzzle (all positions correct).
 */
export function isSolved(attempt: OrderAttempt): boolean {
  return attempt.feedback.every((f) => f === "correct");
}

/**
 * Checks if an ordering would solve the puzzle.
 */
export function wouldSolve(ordering: string[], events: OrderEvent[]): boolean {
  const correctOrder = getCorrectOrder(events);
  return ordering.every((id, idx) => id === correctOrder[idx]);
}

/**
 * Calculates the final score from completed attempts.
 */
export function calculateAttemptScore(attempts: OrderAttempt[]): AttemptScore {
  return {
    attempts: attempts.length,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Returns event IDs in chronological order (earliest first).
 */
export function getCorrectOrder(events: OrderEvent[]): string[] {
  return [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id)).map((e) => e.id);
}

/**
 * Computes per-position feedback: is each event in the correct slot?
 */
function computePositionFeedback(ordering: string[], correctOrder: string[]): PositionFeedback[] {
  return ordering.map((id, idx) => (id === correctOrder[idx] ? "correct" : "incorrect"));
}

/**
 * Counts correctly ordered pairs (for progress display).
 * A pair (i, j) where i < j is correct if event[i] should come before event[j].
 */
function countCorrectPairs(
  ordering: string[],
  correctOrder: string[],
): { correct: number; total: number } {
  const n = ordering.length;
  const total = (n * (n - 1)) / 2;

  // Build position map for O(1) lookup
  const correctPosition = new Map<string, number>();
  correctOrder.forEach((id, idx) => correctPosition.set(id, idx));

  let correct = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const posI = correctPosition.get(ordering[i]) ?? -1;
      const posJ = correctPosition.get(ordering[j]) ?? -1;
      if (posI < posJ) {
        correct++;
      }
    }
  }

  return { correct, total };
}

// =============================================================================
// Progress Metrics
// =============================================================================

/**
 * Returns a human-readable progress string.
 */
export function formatProgress(attempt: OrderAttempt): string {
  const correctCount = attempt.feedback.filter((f) => f === "correct").length;
  const total = attempt.feedback.length;
  return `${correctCount}/${total} correct`;
}

/**
 * Returns accuracy as a percentage (0-100).
 *
 * Defensive guard: Returns 0 if totalPairs is 0 (cannot happen with 6-event puzzles,
 * but protects against edge cases).
 */
export function getAccuracyPercent(attempt: OrderAttempt): number {
  if (attempt.totalPairs === 0) {
    return 0; // Graceful degradation for impossible edge case
  }
  return Math.round((attempt.pairsCorrect / attempt.totalPairs) * 100);
}

/**
 * Returns the number of correctly positioned events.
 */
export function getCorrectPositionCount(attempt: OrderAttempt): number {
  return attempt.feedback.filter((f) => f === "correct").length;
}
