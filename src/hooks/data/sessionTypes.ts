import type { RangeGuess } from "@/types/range";

/**
 * Shared return shape for the anonymous and authenticated session hooks, and
 * for the `useLocalSession` composer that selects between them.
 */
export interface UseLocalSessionReturn {
  sessionGuesses: number[];
  sessionRanges: RangeGuess[];
  addGuess: (n: number) => void;
  addRange: (range: RangeGuess) => void;
  replaceLastRange: (range: RangeGuess) => void;
  removeLastRange: () => void;
  clearGuesses: () => void;
  clearRanges: () => void;
  markComplete: (hasWon: boolean) => void;
}
