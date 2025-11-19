import { GameState, Puzzle } from "@/types/gameState";
import { GAME_CONFIG } from "@/lib/constants";
import { logger } from "@/lib/logger";
import type { RangeGuess } from "@/types/range";

/**
 * Data sources from the orthogonal hooks
 */
export interface DataSources {
  puzzle: {
    puzzle: Puzzle | null;
    isLoading: boolean;
    error: Error | null;
  };
  auth: {
    userId: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  progress: {
    progress: {
      guesses: number[];
      ranges?: RangeGuess[];
      totalScore?: number;
      completedAt: number | null;
    } | null;
    isLoading: boolean;
  };
  session: {
    sessionGuesses: number[];
    sessionRanges?: RangeGuess[];
    addGuess: (n: number) => void;
    clearGuesses: () => void;
    addRange?: (range: RangeGuess) => void;
    replaceLastRange?: (range: RangeGuess) => void;
    removeLastRange?: () => void;
    clearRanges?: () => void;
    markComplete?: (hasWon: boolean) => void;
  };
}

function guessesToLegacyRanges(guesses: number[]): RangeGuess[] {
  return guesses.map((guess, index) => ({
    start: guess,
    end: guess,
    hintsUsed: 0,
    score: 0,
    timestamp: index,
  }));
}

/**
 * Reconciles server and session guesses with priority ordering
 *
 * Performs three critical operations:
 * 1. **Deduplication**: Removes duplicates between server and session guesses
 * 2. **Priority Ordering**: Server guesses come first (source of truth for persistence)
 * 3. **Capping**: Result is capped at MAX_GUESSES (6) to enforce game rules
 *
 * Performance: O(n+m) linear complexity using Set for deduplication
 * Previously O(n*m) due to .includes() in loop - now optimized for future archive mode
 *
 * @param serverGuesses - Guesses from the server (persisted, source of truth)
 * @param sessionGuesses - Guesses from the current session (not yet persisted)
 * @returns Reconciled array with server guesses first, session guesses appended, duplicates removed, capped at 6
 *
 * @example
 * // Typical reconciliation: server has 2 guesses, session adds 1 new guess
 * reconcileGuessesWithPriority([1960, 1970], [1965]);
 * // [1960, 1970, 1965] - session guess appended after server guesses
 *
 * @example
 * // Deduplication: session guess already exists on server
 * reconcileGuessesWithPriority([1960, 1970], [1970, 1965]);
 * // [1960, 1970, 1965] - duplicate 1970 removed, only 1965 added
 *
 * @example
 * // Capping: result exceeds MAX_GUESSES
 * reconcileGuessesWithPriority([1960, 1965, 1970, 1975], [1980, 1985, 1990]);
 * // [1960, 1965, 1970, 1975, 1980, 1985] - capped at 6 guesses
 */
export function reconcileGuessesWithPriority(
  serverGuesses: number[],
  sessionGuesses: number[],
): number[] {
  // Return empty array if both inputs are empty
  if (serverGuesses.length === 0 && sessionGuesses.length === 0) {
    return [];
  }

  // Start with server guesses (source of truth)
  const merged = [...serverGuesses];

  // Use Set for O(1) duplicate checking instead of O(n) .includes()
  const serverSet = new Set(serverGuesses);

  // Add session guesses that aren't duplicates
  for (const guess of sessionGuesses) {
    if (!serverSet.has(guess)) {
      merged.push(guess);
      serverSet.add(guess); // Track added guesses to avoid duplicates within session
    }
  }

  // Cap at MAX_GUESSES
  return merged.slice(0, GAME_CONFIG.MAX_GUESSES);
}

/**
 * Pure function to derive game state from orthogonal data sources
 * Handles loading priorities and merges data to produce a consistent game state
 *
 * Loading priority:
 * 1. Puzzle must load first
 * 2. Then authentication state
 * 3. Then user progress (only if authenticated)
 *
 * @param sources - All data sources from the orthogonal hooks
 * @returns Discriminated union representing the current game state
 * @throws Error if derivation fails due to invalid data
 */
export function deriveGameState(sources: DataSources): GameState {
  try {
    const { puzzle, auth, progress, session } = sources;

    // Priority 1: Check if puzzle is loading
    if (puzzle.isLoading) {
      return { status: "loading-puzzle" };
    }

    // Handle puzzle error
    if (puzzle.error) {
      return {
        status: "error",
        error: puzzle.error.message || "Failed to load puzzle",
      };
    }

    // Handle missing puzzle
    if (!puzzle.puzzle) {
      return {
        status: "error",
        error: "No puzzle available",
      };
    }

    // Priority 2: Check if auth is loading
    if (auth.isLoading) {
      return { status: "loading-auth" };
    }

    // Priority 3: Check if progress is loading (only matters if authenticated)
    if (auth.isAuthenticated && progress.isLoading) {
      return { status: "loading-progress" };
    }

    // At this point, all necessary data is loaded
    // Now derive the ready state

    // Get server guesses from progress (if user is authenticated and has progress)
    const serverGuesses =
      auth.isAuthenticated && progress.progress ? progress.progress.guesses : [];

    // Get session guesses
    const sessionGuesses = session.sessionGuesses;

    // Merge guesses (server first, then session without duplicates)
    const allGuesses = reconcileGuessesWithPriority(serverGuesses, sessionGuesses);

    const serverRanges =
      auth.isAuthenticated && progress.progress?.ranges ? progress.progress.ranges : [];
    const sessionRanges = session.sessionRanges ?? [];

    let mergedRanges: RangeGuess[];
    if ((serverRanges?.length || 0) > 0 || sessionRanges.length > 0) {
      mergedRanges = [...(serverRanges ?? []), ...sessionRanges];
    } else {
      mergedRanges = guessesToLegacyRanges(allGuesses);
    }

    const truncatedRanges = mergedRanges.slice(0, GAME_CONFIG.MAX_GUESSES);

    const totalScoreFromRanges = truncatedRanges.reduce(
      (sum, range) => sum + (range.score || 0),
      0,
    );
    const totalScore =
      typeof progress.progress?.totalScore === "number"
        ? progress.progress.totalScore
        : totalScoreFromRanges;

    // Calculate completion status
    // Complete if:
    // 1. Server has completedAt timestamp OR
    // 2. Last guess equals target year OR
    // 3. Used all guesses
    const hasServerCompletion =
      auth.isAuthenticated &&
      progress.progress?.completedAt !== null &&
      progress.progress?.completedAt !== undefined;

    const lastGuess = allGuesses[allGuesses.length - 1];
    const guessedCorrectly = lastGuess === puzzle.puzzle.targetYear;
    const remainingGuesses = Math.max(0, GAME_CONFIG.MAX_GUESSES - allGuesses.length);
    const remainingAttempts = Math.max(0, GAME_CONFIG.MAX_GUESSES - truncatedRanges.length);

    const hasWinningRange = truncatedRanges.some((range) => range.score > 0);
    const usedAllAttempts = remainingAttempts === 0;

    // ONE GUESS MODE: Game ends after first range submission (win or loss)
    const hasSubmittedRange = truncatedRanges.length > 0 && truncatedRanges[0].score !== undefined;

    const isComplete =
      hasServerCompletion || guessedCorrectly || hasSubmittedRange || usedAllAttempts;

    const hasWon = hasWinningRange || (isComplete && guessedCorrectly);

    // Calculate hintsRevealed: maximum hintsUsed from all ranges (0-6)
    // Hints stay revealed once shown, so we track the highest level reached
    const hintsRevealed = truncatedRanges.reduce(
      (max, range) => Math.max(max, range.hintsUsed ?? 0),
      0,
    );

    // Return ready state with all derived values
    return {
      status: "ready",
      puzzle: puzzle.puzzle,
      guesses: allGuesses,
      ranges: truncatedRanges,
      totalScore,
      isComplete,
      hasWon,
      remainingGuesses,
      remainingAttempts,
      hintsRevealed,
    };
  } catch (error) {
    // Log the error for debugging
    logger.error("Error deriving game state:", error);

    // Return error state with helpful message
    return {
      status: "error",
      error:
        error instanceof Error
          ? `State derivation failed: ${error.message}`
          : "Failed to calculate game state",
    };
  }
}
