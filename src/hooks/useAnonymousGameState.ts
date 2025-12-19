import { useCallback, useMemo } from "react";
import { useAuthState } from "@/hooks/data/useAuthState";
import { GAME_CONFIG } from "@/lib/constants";
import { gameStateStorage } from "@/lib/secureStorage";
import { logger } from "@/lib/logger";

import type { RangeGuess } from "@/types/range";

/**
 * Game state structure for anonymous users
 * Stored in localStorage for persistence across sessions
 */
export interface AnonymousGameState {
  puzzleId: string;
  guesses: number[];
  ranges?: RangeGuess[]; // Range guesses for new game mode
  isComplete: boolean;
  hasWon: boolean;
  timestamp: number;
}

/**
 * Return type for useAnonymousGameState hook
 */
export interface UseAnonymousGameStateReturn {
  /**
   * Save game state to localStorage for anonymous users
   * Does nothing if user is authenticated
   */
  saveGameState: (state: AnonymousGameState) => void;

  /**
   * Load game state from localStorage for anonymous users
   * Returns null if user is authenticated or no saved state exists
   */
  loadGameState: () => AnonymousGameState | null;

  /**
   * Clear anonymous game state from localStorage
   * Used when migrating to authenticated account
   */
  clearAnonymousState: () => void;

  /**
   * Check if anonymous state exists for migration
   */
  hasAnonymousState: () => boolean;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook for managing anonymous user game state persistence
 * Saves game progress to localStorage for users who haven't signed in
 *
 * @returns Functions to save, load, and clear anonymous game state
 */
export function useAnonymousGameState(): UseAnonymousGameStateReturn {
  const { isAuthenticated, isLoading } = useAuthState();

  /**
   * Save game state to localStorage
   * Only saves if user is not authenticated
   */
  const saveGameState = useCallback(
    (state: AnonymousGameState) => {
      // Don't save if user is authenticated or auth is still loading
      if (isAuthenticated || isLoading) {
        return;
      }

      // Don't save if we're not in a browser environment
      if (typeof window === "undefined") {
        return;
      }

      const stateWithTimestamp = {
        ...state,
        timestamp: Date.now(),
      };

      const success = gameStateStorage.set(stateWithTimestamp);
      if (!success) {
        logger.warn("Failed to save anonymous game state");
      }
    },
    [isAuthenticated, isLoading],
  );

  /**
   * Load game state from localStorage
   * Returns null if user is authenticated or no valid state exists
   */
  const loadGameState = useCallback((): AnonymousGameState | null => {
    // Don't load if user is authenticated
    if (isAuthenticated) {
      return null;
    }

    // Don't load if we're not in a browser environment
    if (typeof window === "undefined") {
      return null;
    }

    const stored = gameStateStorage.get();
    if (!stored) {
      return null;
    }

    // Check if state is too old (more than 24 hours)
    if (stored.timestamp && Date.now() - stored.timestamp > MAX_AGE_MS) {
      gameStateStorage.remove();
      return null;
    }

    // Additional validation for guesses length (belt and suspenders)
    if (stored.guesses.length > GAME_CONFIG.MAX_GUESSES) {
      gameStateStorage.remove();
      return null;
    }

    // Normalize the stored data to match AnonymousGameState interface
    return {
      puzzleId: stored.puzzleId,
      guesses: stored.guesses,
      ranges: stored.ranges as RangeGuess[] | undefined,
      isComplete: stored.isComplete,
      hasWon: stored.hasWon,
      timestamp: stored.timestamp,
    };
  }, [isAuthenticated]);

  /**
   * Clear anonymous game state from localStorage
   * Used when migrating to authenticated account
   */
  const clearAnonymousState = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const success = gameStateStorage.remove();
    if (!success) {
      logger.warn("Failed to clear anonymous game state");
    }
  }, []);

  /**
   * Check if anonymous state exists for migration
   */
  const hasAnonymousState = useCallback((): boolean => {
    if (typeof window === "undefined") {
      return false;
    }

    return gameStateStorage.exists();
  }, []);

  // Return memoized object to maintain stable reference
  return useMemo(
    () => ({
      saveGameState,
      loadGameState,
      clearAnonymousState,
      hasAnonymousState,
    }),
    [saveGameState, loadGameState, clearAnonymousState, hasAnonymousState],
  );
}
