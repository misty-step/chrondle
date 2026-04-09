"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore, useRef } from "react";
import { GAME_CONFIG } from "@/lib/constants";
import {
  subscribeToStorage,
  getStorageSnapshot,
  getServerSnapshot,
  updateStorage,
  clearStorage,
  getRangesSnapshot,
} from "@/lib/localStorageSync";
import {
  addRangeToLocalState,
  updateLastRangeInLocalState,
  removeLastRangeFromLocalState,
} from "@/lib/gameDataStore";
import type { RangeGuess } from "@/types/range";

// Stable empty array references to avoid infinite loops
const EMPTY_ARRAY: readonly number[] = Object.freeze([]);
const EMPTY_RANGES_ARRAY: readonly RangeGuess[] = Object.freeze([]);

/**
 * Return type for the useLocalSession hook
 */
interface UseLocalSessionReturn {
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

interface AuthenticatedSessionState {
  puzzleId: string | null;
  guesses: number[];
  ranges: RangeGuess[];
}

/**
 * Hook to manage current game session guesses
 *
 * For anonymous users: Uses localStorage as the single source of truth
 * For authenticated users: Uses React state (server handles persistence)
 *
 * This solves the navigation bug where anonymous users lose their guesses.
 * By using useSyncExternalStore with localStorage, the state persists across
 * navigation and even syncs across tabs.
 *
 * @param puzzleId - The puzzle's ID (null if puzzle not loaded)
 * @param isAuthenticated - Whether the user is authenticated
 * @returns Object containing session guesses and mutation functions
 *
 * @example
 * const { sessionGuesses, addGuess, clearGuesses } = useLocalSession(puzzleId, isAuthenticated);
 *
 * // Add a guess (won't add duplicates or exceed 6 guesses)
 * addGuess(1969);
 *
 * // Clear all session guesses
 * clearGuesses();
 *
 * // For anonymous users: state persists in localStorage
 * // For authenticated users: state is in React state
 */
export function useLocalSession(
  puzzleId: string | null,
  isAuthenticated: boolean = false,
  targetYear?: number,
): UseLocalSessionReturn {
  const [authenticatedSession, setAuthenticatedSession] = useState<AuthenticatedSessionState>(
    () => ({
      puzzleId,
      guesses: [],
      ranges: [],
    }),
  );

  // For anonymous users, use localStorage via useSyncExternalStore
  // This ensures the state persists across navigation and syncs across tabs
  // We always call the hook but the getSnapshot function handles authentication
  // Create a stable ref to avoid recreating the callback
  const stateRef = useRef({ isAuthenticated, puzzleId });
  useEffect(() => {
    stateRef.current = { isAuthenticated, puzzleId };
  }, [isAuthenticated, puzzleId]);

  const getSnapshot = useCallback(() => {
    const { isAuthenticated: isAuth, puzzleId: pid } = stateRef.current;
    // Only read from localStorage if not authenticated
    if (!isAuth && pid) {
      return getStorageSnapshot(pid);
    }
    // Return stable empty array for authenticated users or when no puzzle
    return EMPTY_ARRAY as number[];
  }, []);

  // Snapshot for ranges - also from localStorage for anonymous users
  const getRangesSnapshotCallback = useCallback(() => {
    const { isAuthenticated: isAuth, puzzleId: pid } = stateRef.current;
    // Only read from localStorage if not authenticated
    if (!isAuth && pid) {
      return getRangesSnapshot(pid);
    }
    // Return stable empty array for authenticated users or when no puzzle
    return EMPTY_RANGES_ARRAY as RangeGuess[];
  }, []);

  // Always call useSyncExternalStore (hooks must be called unconditionally)
  const storageGuesses = useSyncExternalStore(subscribeToStorage, getSnapshot, getServerSnapshot);
  const storageRanges = useSyncExternalStore(
    subscribeToStorage,
    getRangesSnapshotCallback,
    () => EMPTY_RANGES_ARRAY as RangeGuess[],
  );

  const currentAuthenticatedSession =
    authenticatedSession.puzzleId === puzzleId
      ? authenticatedSession
      : {
          puzzleId,
          guesses: [],
          ranges: [],
        };

  // Select the appropriate guesses/ranges based on authentication status
  const sessionGuesses = isAuthenticated ? currentAuthenticatedSession.guesses : storageGuesses;
  const sessionRanges = isAuthenticated ? currentAuthenticatedSession.ranges : storageRanges;

  // Add a guess to the session
  const addGuess = useCallback(
    (guess: number) => {
      if (isAuthenticated) {
        // For authenticated users, use React state
        setAuthenticatedSession((prevSession) => {
          const currentSession =
            prevSession.puzzleId === puzzleId
              ? prevSession
              : {
                  puzzleId,
                  guesses: [],
                  ranges: [],
                };

          // Don't exceed max guesses
          if (currentSession.guesses.length >= GAME_CONFIG.MAX_GUESSES) {
            return currentSession;
          }

          // Don't add duplicates
          if (currentSession.guesses.includes(guess)) {
            return currentSession;
          }

          return {
            ...currentSession,
            guesses: [...currentSession.guesses, guess],
          };
        });
      } else if (puzzleId) {
        // For anonymous users, update localStorage directly
        const currentGuesses = getStorageSnapshot(puzzleId);

        // Don't exceed max guesses
        if (currentGuesses.length >= GAME_CONFIG.MAX_GUESSES) {
          return;
        }

        // Don't add duplicates
        if (currentGuesses.includes(guess)) {
          return;
        }

        // Check if this guess wins the game
        const newGuesses = [...currentGuesses, guess];
        const hasWon = targetYear !== undefined && guess === targetYear;
        const isComplete = hasWon || newGuesses.length >= GAME_CONFIG.MAX_GUESSES;

        // Update localStorage with the new guess and completion status
        updateStorage(puzzleId, newGuesses, isComplete, hasWon);
      }
    },
    [isAuthenticated, puzzleId, targetYear],
  );

  // Clear all session guesses
  const clearGuesses = useCallback(() => {
    if (isAuthenticated) {
      // For authenticated users, clear React state
      setAuthenticatedSession((prevSession) => ({
        puzzleId,
        guesses: [],
        ranges: prevSession.puzzleId === puzzleId ? prevSession.ranges : [],
      }));
    } else if (puzzleId) {
      // For anonymous users, clear localStorage
      clearStorage(puzzleId);
    }
  }, [isAuthenticated, puzzleId]);

  const addRange = useCallback(
    (range: RangeGuess) => {
      if (isAuthenticated) {
        // For authenticated users, use React state
        setAuthenticatedSession((prevSession) => {
          const currentSession =
            prevSession.puzzleId === puzzleId
              ? prevSession
              : {
                  puzzleId,
                  guesses: [],
                  ranges: [],
                };
          if (currentSession.ranges.length >= GAME_CONFIG.MAX_GUESSES) {
            return currentSession;
          }
          return {
            ...currentSession,
            ranges: [...currentSession.ranges, range],
          };
        });
      } else if (puzzleId) {
        // For anonymous users, persist to localStorage
        const currentRanges = getRangesSnapshot(puzzleId);
        if (currentRanges.length >= GAME_CONFIG.MAX_GUESSES) {
          return;
        }

        // Check if this range wins the game
        const hasWon = targetYear !== undefined && range.score > 0;
        const isComplete = hasWon || currentRanges.length + 1 >= GAME_CONFIG.MAX_GUESSES;

        addRangeToLocalState(puzzleId, range, isComplete, hasWon);
      }
    },
    [isAuthenticated, puzzleId, targetYear],
  );

  const replaceLastRange = useCallback(
    (range: RangeGuess) => {
      if (isAuthenticated) {
        // For authenticated users, use React state
        setAuthenticatedSession((prevSession) => {
          const currentSession =
            prevSession.puzzleId === puzzleId
              ? prevSession
              : {
                  puzzleId,
                  guesses: [],
                  ranges: [],
                };
          if (currentSession.ranges.length === 0) {
            return currentSession;
          }
          const next = [...currentSession.ranges];
          next[next.length - 1] = range;
          return {
            ...currentSession,
            ranges: next,
          };
        });
      } else if (puzzleId) {
        // For anonymous users, update localStorage
        updateLastRangeInLocalState(puzzleId, range);
      }
    },
    [isAuthenticated, puzzleId],
  );

  const removeLastRange = useCallback(() => {
    if (isAuthenticated) {
      setAuthenticatedSession((prevSession) => {
        const currentSession =
          prevSession.puzzleId === puzzleId
            ? prevSession
            : {
                puzzleId,
                guesses: [],
                ranges: [],
              };
        return {
          ...currentSession,
          ranges: currentSession.ranges.length
            ? currentSession.ranges.slice(0, -1)
            : currentSession.ranges,
        };
      });
    } else if (puzzleId) {
      removeLastRangeFromLocalState(puzzleId);
    }
  }, [isAuthenticated, puzzleId]);

  const clearRanges = useCallback(() => {
    if (isAuthenticated) {
      setAuthenticatedSession((prevSession) => ({
        puzzleId,
        guesses: prevSession.puzzleId === puzzleId ? prevSession.guesses : [],
        ranges: [],
      }));
    }
    // For anonymous users, clearing ranges would need to preserve guesses
    // This is typically not needed as we clear on puzzle change
  }, [isAuthenticated, puzzleId]);

  // Mark game as complete (for anonymous users)
  const markComplete = useCallback(
    (hasWon: boolean) => {
      if (!isAuthenticated && puzzleId) {
        const currentGuesses = getStorageSnapshot(puzzleId);
        updateStorage(puzzleId, currentGuesses, true, hasWon);
      }
    },
    [isAuthenticated, puzzleId],
  );

  // Memoize the return value to ensure stable references
  return useMemo<UseLocalSessionReturn>(
    () => ({
      sessionGuesses,
      sessionRanges,
      addGuess,
      addRange,
      replaceLastRange,
      removeLastRange,
      clearGuesses,
      clearRanges,
      markComplete,
    }),
    [
      sessionGuesses,
      sessionRanges,
      addGuess,
      addRange,
      replaceLastRange,
      removeLastRange,
      clearGuesses,
      clearRanges,
      markComplete,
    ],
  );
}
