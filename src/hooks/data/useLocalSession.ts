"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore, useRef } from "react";
import { GAME_CONFIG } from "@/lib/constants";
import {
  subscribeToStorage,
  getStorageSnapshot,
  getServerSnapshot,
  updateStorage,
  clearStorage,
} from "@/lib/localStorageSync";
import type { RangeGuess } from "@/types/range";

// Stable empty array reference to avoid infinite loops
const EMPTY_ARRAY: readonly number[] = Object.freeze([]);

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
  // For authenticated users, use React state
  const [authenticatedGuesses, setAuthenticatedGuesses] = useState<number[]>([]);
  const [sessionRangesState, setSessionRangesState] = useState<RangeGuess[]>([]);

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

  // Always call useSyncExternalStore (hooks must be called unconditionally)
  const storageGuesses = useSyncExternalStore(subscribeToStorage, getSnapshot, getServerSnapshot);

  // Select the appropriate guesses based on authentication status
  const sessionGuesses = isAuthenticated ? authenticatedGuesses : storageGuesses;
  const sessionRanges = sessionRangesState;

  // Reset authenticated guesses when puzzle changes
  useEffect(() => {
    if (isAuthenticated && puzzleId) {
      setAuthenticatedGuesses([]);
      setSessionRangesState([]);
    }
  }, [puzzleId, isAuthenticated]);

  // Add a guess to the session
  const addGuess = useCallback(
    (guess: number) => {
      if (isAuthenticated) {
        // For authenticated users, use React state
        setAuthenticatedGuesses((prevGuesses) => {
          // Don't exceed max guesses
          if (prevGuesses.length >= GAME_CONFIG.MAX_GUESSES) {
            return prevGuesses;
          }

          // Don't add duplicates
          if (prevGuesses.includes(guess)) {
            return prevGuesses;
          }

          // Add the new guess
          return [...prevGuesses, guess];
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
      setAuthenticatedGuesses([]);
    } else if (puzzleId) {
      // For anonymous users, clear localStorage
      clearStorage(puzzleId);
    }
  }, [isAuthenticated, puzzleId]);

  const addRange = useCallback((range: RangeGuess) => {
    setSessionRangesState((prev) => {
      if (prev.length >= GAME_CONFIG.MAX_GUESSES) {
        return prev;
      }
      return [...prev, range];
    });
  }, []);

  const replaceLastRange = useCallback((range: RangeGuess) => {
    setSessionRangesState((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const next = [...prev];
      next[next.length - 1] = range;
      return next;
    });
  }, []);

  const removeLastRange = useCallback(() => {
    setSessionRangesState((prev) => (prev.length ? prev.slice(0, -1) : prev));
  }, []);

  const clearRanges = useCallback(() => {
    setSessionRangesState([]);
  }, []);

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
