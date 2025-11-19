/**
 * Order puzzle scoring logic for server-side validation
 */

type StoredOrderEvent = {
  id: string;
  year: number;
  text: string;
};

type OrderScore = {
  totalScore: number;
  correctPairs: number;
  totalPairs: number;
  perfectPositions: number;
  hintsUsed: number;
};

export function scoreOrderSubmission(
  playerOrdering: string[],
  events: StoredOrderEvent[],
  hintsUsed: number,
): OrderScore {
  const chronological = [...events].sort((a, b) => a.year - b.year).map((event) => event.id);
  const totalPairs = (playerOrdering.length * (playerOrdering.length - 1)) / 2;
  let correctPairs = 0;
  let perfectPositions = 0;

  // Count perfect positions (event at exact correct index)
  for (let i = 0; i < playerOrdering.length; i++) {
    if (playerOrdering[i] === chronological[i]) {
      perfectPositions += 1;
    }
  }

  // Count correct pairwise orderings
  for (let i = 0; i < playerOrdering.length; i++) {
    for (let j = i + 1; j < playerOrdering.length; j++) {
      const first = playerOrdering[i];
      const second = playerOrdering[j];
      if (chronological.indexOf(first) < chronological.indexOf(second)) {
        correctPairs += 1;
      }
    }
  }

  // Simple accuracy-based scoring: 2 points per correct pair
  // Max score: 30 for 6 events (15 pairs * 2)
  const totalScore = correctPairs * 2;

  return {
    totalScore,
    correctPairs,
    totalPairs,
    perfectPositions,
    hintsUsed,
  };
}
