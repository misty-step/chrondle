/**
 * Order game validation helpers for server-side verification
 *
 * ARCHITECTURE NOTE: This module duplicates client logic from src/lib/order/attemptScoring.ts
 * This is intentional and necessary:
 * 1. Security boundary - server must independently verify client submissions
 * 2. Module context - Convex cannot import from src/ directory
 * 3. Information hiding - server validation must not depend on client code
 *
 * DESIGN PRINCIPLE: Deep module pattern (Ousterhout)
 * - Simple interface: 5 pure functions
 * - Complex implementation: Handles all validation edge cases internally
 * - Pulls complexity downward: Callers don't need to know validation details
 */

// =============================================================================
// Type Definitions
// =============================================================================

/** Event stored in Convex database */
type StoredOrderEvent = {
  id: string;
  year: number;
  text: string;
};

/** Feedback for a single position in ordering */
export type PositionFeedback = "correct" | "incorrect";

/** Result of evaluating an ordering attempt */
type AttemptValidation = {
  ordering: string[];
  feedback: PositionFeedback[];
  pairsCorrect: number;
  totalPairs: number;
};

// =============================================================================
// Public Interface (5 functions - simple, powerful)
// =============================================================================

/**
 * Returns event IDs in chronological order (earliest first).
 *
 * Handles year ties deterministically via ID sort for consistent ordering.
 */
export function getCorrectOrder(events: StoredOrderEvent[]): string[] {
  return [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id)).map((e) => e.id);
}

/**
 * Checks if ordering matches chronological order.
 *
 * This is the primary validation for "puzzle solved" state.
 */
export function wouldSolve(ordering: string[], events: StoredOrderEvent[]): boolean {
  const correctOrder = getCorrectOrder(events);
  return ordering.every((id, idx) => id === correctOrder[idx]);
}

/**
 * Re-evaluates ordering and returns honest feedback.
 *
 * This is the core validation function - it recomputes everything from scratch
 * based on ground truth (event years), never trusting client-provided data.
 */
export function evaluateOrdering(
  ordering: string[],
  events: StoredOrderEvent[],
): AttemptValidation {
  const correctOrder = getCorrectOrder(events);
  const feedback = computePositionFeedback(ordering, correctOrder);
  const { correct: pairsCorrect, total: totalPairs } = countCorrectPairs(ordering, correctOrder);

  return { ordering, feedback, pairsCorrect, totalPairs };
}

/**
 * Checks if attempt has all positions correct.
 *
 * Used to verify final attempt is actually solved before persisting.
 */
export function isSolved(attempt: { feedback: PositionFeedback[] }): boolean {
  return attempt.feedback.every((f) => f === "correct");
}

/**
 * Deep equality check for arrays.
 *
 * Used to verify client-provided feedback matches server recomputation.
 */
export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

// =============================================================================
// Private Implementation (complexity hidden from callers)
// =============================================================================

/**
 * Computes per-position feedback: is each event in the correct slot?
 */
function computePositionFeedback(ordering: string[], correctOrder: string[]): PositionFeedback[] {
  return ordering.map((id, idx) => (id === correctOrder[idx] ? "correct" : "incorrect"));
}

/**
 * Counts correctly ordered pairs (for progress metrics).
 *
 * A pair (i, j) where i < j is correct if event[i] should come before event[j].
 * Uses O(n²) nested loops but acceptable for n=6 events (15 pairs).
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
