"use node";

/**
 * Puzzle Composition Module
 *
 * Provides puzzle-level quality judging and hint ordering.
 *
 * Components:
 * - schemas: Zod types for Judge I/O
 * - judge: Puzzle Judge LLM (Gemini 3 Flash)
 * - composer: Orchestration with retry logic
 * - optimizePuzzle: Action to judge and update puzzles
 */

export * from "./schemas";
export { judgePuzzle, judgePuzzleComposition } from "./judge";
export {
  composePuzzle,
  composePuzzleWithJudge,
  composePuzzleWithRetries,
  legacyShuffleEvents,
} from "./composer";
export { isPuzzleJudgeEnabled } from "../../lib/featureFlags";
export { optimizePuzzleComposition } from "./optimizePuzzle";
