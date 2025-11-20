import type { OrderEvent, OrderScore } from "@/types/orderGameState";

/**
 * Calculate the Order mode score given a proposed ordering and the puzzle events.
 * Falls back to the baseline event order when no ordering has been recorded yet.
 */
export function calculateOrderScore(
  ordering: string[],
  events: OrderEvent[],
  hintCount: number,
): OrderScore {
  const resolvedOrdering = ordering.length ? ordering : events.map((event) => event.id);
  const trueOrder = [...events].sort((a, b) => a.year - b.year).map((event) => event.id);

  const n = resolvedOrdering.length;
  const totalPairs = (n * (n - 1)) / 2;
  let correctPairs = 0;
  let perfectPositions = 0;

  // Count perfect positions (event at exact correct index)
  for (let i = 0; i < n; i++) {
    if (resolvedOrdering[i] === trueOrder[i]) {
      perfectPositions += 1;
    }
  }

  // Count correct pairwise orderings
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const first = resolvedOrdering[i];
      const second = resolvedOrdering[j];
      if (trueOrder.indexOf(first) < trueOrder.indexOf(second)) {
        correctPairs += 1;
      }
    }
  }

  return {
    totalScore: correctPairs * 2,
    correctPairs,
    totalPairs,
    perfectPositions,
    hintsUsed: hintCount,
  };
}
