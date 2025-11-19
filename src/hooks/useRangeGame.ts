"use client";

import { useMemo, useEffect, useRef, useDeferredValue } from "react";
import { usePuzzleData } from "@/hooks/data/usePuzzleData";
import { useAuthState } from "@/hooks/data/useAuthState";
import { useUserProgress } from "@/hooks/data/useUserProgress";
import { useLocalSession } from "@/hooks/data/useLocalSession";
import { useGameActions, UseGameActionsReturn } from "@/hooks/actions/useGameActions";
import { deriveGameState, DataSources } from "@/lib/deriveGameState";
import { GameState } from "@/types/gameState";
import { useAnalytics, usePerformanceTracking } from "@/hooks/useAnalytics";
import { isValidConvexId } from "@/lib/validation";
import { useDebouncedValues } from "@/hooks/useDebouncedValue";
import { logger } from "@/lib/logger";

/**
 * Return type for the useRangeGame hook
 */
export interface UseRangeGameReturn extends UseGameActionsReturn {
  gameState: GameState;
}

/**
 * Main composition hook for the Chrondle game
 *
 * This hook orchestrates all data sources and derives the game state
 * using pure functional derivation. It solves the race condition problem
 * by treating state as a projection of orthogonal data sources rather
 * than something to initialize imperatively.
 *
 * @param puzzleNumber - Optional puzzle number for archive puzzles
 * @param initialPuzzle - Optional initial puzzle data (for SSR/preloading)
 * @returns Combined game state and action handlers
 *
 * @example
 * // For daily puzzle
 * const { gameState, submitGuess, resetGame, isSubmitting } = useRangeGame();
 *
 * if (isReady(gameState)) {
 *   logger.debug(`Playing puzzle #${gameState.puzzle.puzzleNumber}`);
 *   logger.debug(`Guesses: ${gameState.guesses.length}/${gameState.remainingGuesses + gameState.guesses.length}`);
 * }
 *
 * @example
 * // For archive puzzle
 * const { gameState, submitGuess } = useRangeGame(42);
 *
 * @example
 * // With preloaded puzzle data from server
 * const { gameState, submitGuess } = useRangeGame(undefined, serverPuzzle);
 */
export function useRangeGame(puzzleNumber?: number, initialPuzzle?: unknown): UseRangeGameReturn {
  // Compose all orthogonal data sources
  // Hooks must be called unconditionally due to React rules
  const puzzle = usePuzzleData(puzzleNumber, initialPuzzle);
  const auth = useAuthState();

  // Defensive validation: Only pass userId if it's a valid Convex ID format
  // This prevents any potential race conditions where an invalid ID might be passed
  const validatedUserId = useMemo(() => {
    if (!auth.userId) {
      return null;
    }

    // Validate the ID format before passing it to useUserProgress
    if (!isValidConvexId(auth.userId)) {
      if (process.env.NODE_ENV === "development") {
        logger.error("[useRangeGame] Invalid user ID format detected - skipping progress query:", {
          userId: auth.userId,
          isAuthenticated: auth.isAuthenticated,
          isLoading: auth.isLoading,
        });
      }
      return null; // Don't attempt to query with invalid ID
    }

    return auth.userId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.userId]); // Only auth.userId is used in the memo function

  // Memoize the parameters object to prevent recreation on every render
  // This is critical - without memoization, the object reference changes on every render
  // causing useDebouncedValues to think the values have changed even when they haven't
  const progressParams = useMemo(
    () => ({
      userId: validatedUserId,
      puzzleId: puzzle.puzzle?.id || null,
    }),
    [validatedUserId, puzzle.puzzle?.id],
  );

  // Debounce the useUserProgress parameters to prevent rapid-fire queries during auth transitions
  // This prevents queries from firing when userId or puzzleId change rapidly
  const debouncedProgressParams = useDebouncedValues(
    progressParams,
    100, // 100ms delay to group rapid parameter changes
  );

  // Use debounced parameters for the progress query
  const progress = useUserProgress(
    debouncedProgressParams.userId,
    debouncedProgressParams.puzzleId,
  );
  // Pass isAuthenticated and targetYear to useLocalSession
  // This allows it to determine game completion for anonymous users
  const session = useLocalSession(
    puzzle.puzzle?.id || null,
    auth.isAuthenticated,
    puzzle.puzzle?.targetYear,
  );

  // No need to load anonymous state anymore - useLocalSession handles it directly

  // Create data sources object for derivation and actions
  const dataSources: DataSources = useMemo(
    () => ({
      puzzle,
      auth,
      progress,
      session,
    }),
    [puzzle, auth, progress, session],
  );

  // Performance tracking for state derivation
  const { measureDerivation } = usePerformanceTracking();

  // Derive game state from data sources using pure function with performance tracking
  // The deriveGameState function has error handling built in
  const gameState = useMemo(
    () => measureDerivation(() => deriveGameState(dataSources)),
    [dataSources, measureDerivation],
  );

  // No need to save anonymous state anymore - useLocalSession handles it directly
  // The localStorage is updated immediately when guesses are added

  // Get game actions (submitGuess, resetGame, isSubmitting)
  const actions = useGameActions(dataSources);

  // Defer non-critical updates for analytics and logging
  // These don't affect user interaction so can be batched by React
  const deferredGameState = useDeferredValue(gameState);
  const deferredSessionGuesses = useDeferredValue(session.sessionGuesses);
  const deferredServerGuesses = useDeferredValue(progress.progress?.guesses || []);

  // Analytics tracking for state transitions and divergence detection
  // Uses deferred values to prevent blocking user interactions
  useAnalytics({
    gameState: deferredGameState,
    userId: auth.userId,
    puzzleNumber: puzzle.puzzle?.puzzleNumber,
    sessionGuesses: deferredSessionGuesses,
    serverGuesses: deferredServerGuesses,
    enabled:
      process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true",
  });

  // Development-only state transition logging
  // Uses deferred state to avoid blocking renders
  useStateTransitionLogger(deferredGameState);

  // Return combined state and actions with perfect memoization
  return useMemo(
    () => ({
      gameState,
      ...actions,
    }),
    [gameState, actions],
  );
}

/**
 * Development-only hook for logging state transitions
 * Helps debug state changes and race conditions
 */
function useStateTransitionLogger(gameState: GameState): void {
  const prevStateRef = useRef<GameState | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    // Only log in development
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Skip first render
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      prevStateRef.current = gameState;
      return;
    }

    // Update ref for next comparison
    prevStateRef.current = gameState;
  }, [gameState]);
}
