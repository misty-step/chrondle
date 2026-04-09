/**
 * React hook for integrating analytics with game state
 *
 * This hook:
 * - Tracks state transitions automatically
 * - Monitors for state divergence
 * - Tracks user interactions
 * - Provides analytics context to components
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { GameState, isReady } from "@/types/gameState";
import { analytics, AnalyticsEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";

/**
 * Hook parameters
 */
interface UseAnalyticsParams {
  gameState: GameState;
  userId?: string | null;
  puzzleNumber?: number;
  sessionGuesses?: number[];
  serverGuesses?: number[];
  enabled?: boolean;
}

/**
 * Return type for useAnalytics hook
 */
export interface UseAnalyticsReturn {
  trackGuess: (guess: number, targetYear: number, guessNumber: number, isCorrect: boolean) => void;
  trackCompletion: (won: boolean, guessCount: number, timeSpent: number) => void;
  trackHintView: (hintNumber: number) => void;
  checkDivergence: () => void;
  getAnalyticsSummary: () => Record<string, unknown>;
}

/**
 * Analytics hook for game state tracking
 *
 * @example
 * const analytics = useAnalytics({
 *   gameState,
 *   userId: auth.userId,
 *   puzzleNumber: puzzle.puzzleNumber,
 *   sessionGuesses: session.sessionGuesses,
 *   serverGuesses: progress?.guesses || []
 * });
 *
 * // Track a guess
 * analytics.trackGuess(1969, 1970, 1, false);
 *
 * // Track completion
 * analytics.trackCompletion(true, 3, 45000);
 */
export function useAnalytics({
  gameState,
  userId,
  puzzleNumber,
  sessionGuesses = [],
  serverGuesses = [],
  enabled = true,
}: UseAnalyticsParams): UseAnalyticsReturn {
  // Track previous state for transitions
  const prevStateRef = useRef<GameState | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastDivergenceCheckRef = useRef<number>(0);

  useEffect(() => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
  }, []);

  // Track state transitions
  useEffect(() => {
    if (!enabled) return;

    const prevState = prevStateRef.current;

    // Track state transition
    if (prevState && prevState.status !== gameState.status) {
      analytics.trackStateTransition(prevState, gameState, {
        userId,
        puzzleNumber,
        transitionTime: Date.now() - startTimeRef.current,
      });
    }

    // Track game loaded
    if (!prevState && gameState.status === "ready") {
      analytics.track(
        AnalyticsEvent.GAME_LOADED,
        {
          puzzleNumber,
          loadTime: Date.now() - startTimeRef.current,
        },
        userId,
        puzzleNumber,
      );
    }

    // Track game completion
    if (
      isReady(gameState) &&
      gameState.isComplete &&
      (!prevState || !isReady(prevState) || !prevState.isComplete)
    ) {
      const timeSpent = Date.now() - startTimeRef.current;
      analytics.trackCompletion(
        gameState.hasWon,
        gameState.guesses.length,
        timeSpent,
        puzzleNumber || 0,
        userId,
      );
    }

    // Update ref for next comparison
    prevStateRef.current = gameState;
  }, [gameState, userId, puzzleNumber, enabled]);

  // Check for state divergence periodically
  useEffect(() => {
    if (!enabled) return;

    // Only check every 5 seconds to avoid excessive checks
    const now = Date.now();
    if (now - lastDivergenceCheckRef.current < 5000) return;
    lastDivergenceCheckRef.current = now;

    // Only check if we have both session and server data
    if (sessionGuesses.length > 0 || serverGuesses.length > 0) {
      const divergence = analytics.detectDivergence(sessionGuesses, serverGuesses, userId);

      if (divergence.hasDivergence) {
        logger.warn("[Analytics] State divergence detected:", divergence);
      }
    }
  }, [sessionGuesses, serverGuesses, userId, enabled]);

  // Track guess submission
  const trackGuess = useCallback(
    (guess: number, targetYear: number, guessNumber: number, isCorrect: boolean) => {
      if (!enabled) return;
      analytics.trackGuess(guess, targetYear, guessNumber, isCorrect, userId);
    },
    [userId, enabled],
  );

  // Track game completion
  const trackCompletion = useCallback(
    (won: boolean, guessCount: number, timeSpent: number) => {
      if (!enabled) return;
      analytics.trackCompletion(won, guessCount, timeSpent, puzzleNumber || 0, userId);
    },
    [userId, puzzleNumber, enabled],
  );

  // Track hint view
  const trackHintView = useCallback(
    (hintNumber: number) => {
      if (!enabled) return;
      analytics.track(
        AnalyticsEvent.HINT_VIEWED,
        {
          hintNumber,
          puzzleNumber,
        },
        userId,
        puzzleNumber,
      );
    },
    [userId, puzzleNumber, enabled],
  );

  // Manual divergence check
  const checkDivergence = useCallback(() => {
    if (!enabled) return;
    const divergence = analytics.detectDivergence(sessionGuesses, serverGuesses, userId);
    return divergence;
  }, [sessionGuesses, serverGuesses, userId, enabled]);

  // Get analytics summary
  const getAnalyticsSummary = useCallback(() => {
    return analytics.getSummary();
  }, []);

  // Memoize return value
  return useMemo(
    () => ({
      trackGuess,
      trackCompletion,
      trackHintView,
      checkDivergence,
      getAnalyticsSummary,
    }),
    [trackGuess, trackCompletion, trackHintView, checkDivergence, getAnalyticsSummary],
  );
}

/**
 * Hook for performance tracking
 */
export function usePerformanceTracking() {
  const measureDerivation = useCallback(<T>(fn: () => T): T => {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    analytics.trackPerformance("derivation", duration, {
      operation: "state_derivation",
    });

    return result;
  }, []);

  const measureQuery = useCallback(
    async <T>(queryName: string, fn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        const result = await fn();
        const duration = performance.now() - start;

        analytics.trackPerformance("query", duration, {
          queryName,
        });

        return result;
      } catch (error) {
        const duration = performance.now() - start;

        analytics.trackPerformance("query", duration, {
          queryName,
          error: true,
        });

        throw error;
      }
    },
    [],
  );

  return { measureDerivation, measureQuery };
}
