/**
 * Discriminated union type for all possible game states
 * Each state represents a specific phase in the data loading and game lifecycle
 */

import type { Puzzle } from "./puzzle";
import type { RangeGuess } from "./range";

// Re-export for convenience
export type { Puzzle } from "./puzzle";

/**
 * Game is loading the puzzle data
 * Occurs when: Application starts or puzzle number changes
 */
export interface LoadingPuzzleState {
  status: "loading-puzzle";
}

/**
 * Game is loading authentication state
 * Occurs when: Puzzle loaded but auth state not yet determined
 */
export interface LoadingAuthState {
  status: "loading-auth";
}

/**
 * Game is loading user progress data
 * Occurs when: Puzzle and auth loaded, fetching user's play history
 */
export interface LoadingProgressState {
  status: "loading-progress";
}

/**
 * Game is ready to play with all data loaded
 * Occurs when: All data sources have resolved successfully
 */
export interface ReadyState {
  status: "ready";
  puzzle: Puzzle;
  guesses: number[];
  ranges: RangeGuess[];
  totalScore: number;
  isComplete: boolean;
  hasWon: boolean;
  remainingGuesses: number;
  remainingAttempts: number;
  hintsRevealed: number; // 0-6: number of historical event hints revealed
}

/**
 * An error occurred during data loading
 * Occurs when: Any data source fails to load
 */
export interface ErrorState {
  status: "error";
  error: string;
}

/**
 * Discriminated union of all possible game states
 * Use the status field to determine which state is active
 */
export type GameState =
  | LoadingPuzzleState
  | LoadingAuthState
  | LoadingProgressState
  | ReadyState
  | ErrorState;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if game state is loading puzzle
 *
 * @param state - The current game state
 * @returns True if the puzzle is currently loading
 *
 * @example
 * if (isLoadingPuzzle(gameState)) {
 *   return <LoadingSpinner text="Loading puzzle..." />;
 * }
 */
export function isLoadingPuzzle(state: GameState): state is LoadingPuzzleState {
  return state.status === "loading-puzzle";
}

/**
 * Type guard to check if game state is loading auth
 *
 * @param state - The current game state
 * @returns True if authentication state is being determined
 *
 * @example
 * if (isLoadingAuth(gameState)) {
 *   return <LoadingSpinner text="Checking authentication..." />;
 * }
 */
export function isLoadingAuth(state: GameState): state is LoadingAuthState {
  return state.status === "loading-auth";
}

/**
 * Type guard to check if game state is loading progress
 *
 * @param state - The current game state
 * @returns True if user progress is being loaded from the server
 *
 * @example
 * if (isLoadingProgress(gameState)) {
 *   return <LoadingSpinner text="Loading your progress..." />;
 * }
 */
export function isLoadingProgress(state: GameState): state is LoadingProgressState {
  return state.status === "loading-progress";
}

/**
 * Type guard to check if game is ready to play
 * @example
 * const gameState = deriveGameState(data);
 * if (isReady(gameState)) {
 *   logger.debug(`Playing puzzle #${gameState.puzzle.puzzleNumber}`);
 *   logger.debug(`Guesses: ${gameState.guesses.length}/${6}`);
 * }
 */
export function isReady(state: GameState): state is ReadyState {
  return state.status === "ready";
}

/**
 * Type guard to check if an error occurred
 *
 * @param state - The current game state
 * @returns True if the game is in an error state
 *
 * @example
 * if (isError(gameState)) {
 *   return <ErrorMessage message={gameState.error} />;
 * }
 */
export function isError(state: GameState): state is ErrorState {
  return state.status === "error";
}

/**
 * Type guard to check if game is in any loading state
 *
 * @param state - The current game state
 * @returns True if the game is loading puzzle, auth, or progress
 *
 * @example
 * if (isLoading(gameState)) {
 *   return <LoadingOverlay />;
 * }
 */
export function isLoading(state: GameState): boolean {
  return (
    state.status === "loading-puzzle" ||
    state.status === "loading-auth" ||
    state.status === "loading-progress"
  );
}

/**
 * Helper to get a user-friendly loading message
 *
 * @param state - The current game state
 * @returns Human-readable loading message or null if not loading
 *
 * @example
 * const message = getLoadingMessage(gameState);
 * if (message) {
 *   return <LoadingSpinner text={message} />;
 * }
 */
export function getLoadingMessage(state: GameState): string | null {
  switch (state.status) {
    case "loading-puzzle":
      return "Loading puzzle...";
    case "loading-auth":
      return "Checking authentication...";
    case "loading-progress":
      return "Loading your progress...";
    default:
      return null;
  }
}
