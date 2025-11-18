/**
 * Puzzle system barrel file for backward compatibility
 *
 * Re-exports from focused modules:
 * - puzzles/queries.ts - Query operations
 * - puzzles/mutations.ts - Guess submissions
 * - puzzles/generation.ts - Daily puzzle generation
 * - puzzles/context.ts - Historical context updates
 * - plays/queries.ts - User play history
 * - system/scheduling.ts - Cron scheduling
 */

// Re-export query functions for backward compatibility (until Phase 4 frontend migration)
export {
  getDailyPuzzle,
  getPuzzleById,
  getPuzzleByNumber,
  getArchivePuzzles,
  getTotalPuzzles,
  getPuzzleYears,
} from "./puzzles/queries";

// Re-export mutation functions for backward compatibility
export { submitGuess, submitRange } from "./puzzles/mutations";

// Re-export generation functions for backward compatibility
export {
  generateDailyPuzzle,
  ensureTodaysPuzzle,
  manualGeneratePuzzle,
} from "./puzzles/generation";

// Re-export play queries for backward compatibility
export { getUserPlay, getUserCompletedPuzzles } from "./plays/queries";

// Re-export system scheduling for backward compatibility
export { getCronSchedule } from "./system/scheduling";

// Re-export puzzle context updates for backward compatibility
export { updateHistoricalContext } from "./puzzles/context";
