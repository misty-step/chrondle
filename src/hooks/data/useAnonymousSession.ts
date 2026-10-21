"use client";

import { useCallback, useSyncExternalStore, useEffect } from "react";
import { gameStateStorage } from "@/lib/secureStorage";
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
import type { UseLocalSessionReturn } from "./sessionTypes";

// Stable empty array references to avoid infinite loops
const EMPTY_ARRAY: readonly number[] = Object.freeze([]);
const EMPTY_RANGES_ARRAY: readonly RangeGuess[] = Object.freeze([]);

/**
 * Session persistence for anonymous (unauthenticated) users.
 *
 * localStorage is the single source of truth. Uses useSyncExternalStore so
 * state persists across navigation and stays in sync across tabs.
 *
 * @param puzzleId - The puzzle's ID (null if puzzle not loaded)
 * @param targetYear - The winning year, used to detect a winning guess
 */
export function useAnonymousSession(
  puzzleId: string | null,
  targetYear?: number,
): UseLocalSessionReturn {
  useEffect(() => {
    void gameStateStorage.migrateLegacy();
  }, [puzzleId]);

  const getSnapshot = useCallback(() => {
    return puzzleId ? getStorageSnapshot(puzzleId) : (EMPTY_ARRAY as number[]);
  }, [puzzleId]);

  const getRangesSnapshotCallback = useCallback(() => {
    return puzzleId ? getRangesSnapshot(puzzleId) : (EMPTY_RANGES_ARRAY as RangeGuess[]);
  }, [puzzleId]);

  const sessionGuesses = useSyncExternalStore(subscribeToStorage, getSnapshot, getServerSnapshot);
  const sessionRanges = useSyncExternalStore(
    subscribeToStorage,
    getRangesSnapshotCallback,
    () => EMPTY_RANGES_ARRAY as RangeGuess[],
  );

  const addGuess = useCallback(
    (guess: number) => {
      if (!puzzleId) return;

      const currentGuesses = getStorageSnapshot(puzzleId);
      if (currentGuesses.length >= GAME_CONFIG.MAX_GUESSES) return;
      if (currentGuesses.includes(guess)) return;

      const newGuesses = [...currentGuesses, guess];
      const hasWon = targetYear !== undefined && guess === targetYear;
      const isComplete = hasWon || newGuesses.length >= GAME_CONFIG.MAX_GUESSES;

      updateStorage(puzzleId, newGuesses, isComplete, hasWon);
    },
    [puzzleId, targetYear],
  );

  const clearGuesses = useCallback(() => {
    if (puzzleId) clearStorage(puzzleId);
  }, [puzzleId]);

  const addRange = useCallback(
    (range: RangeGuess) => {
      if (!puzzleId) return false;

      const currentRanges = getRangesSnapshot(puzzleId);
      if (currentRanges.length > 0) return false;

      const hasWon = targetYear !== undefined && range.score > 0;
      const isComplete = true;

      return addRangeToLocalState(puzzleId, range, isComplete, hasWon);
    },
    [puzzleId, targetYear],
  );

  const replaceLastRange = useCallback(
    (range: RangeGuess) => {
      if (puzzleId) updateLastRangeInLocalState(puzzleId, range);
    },
    [puzzleId],
  );

  const removeLastRange = useCallback(() => {
    if (puzzleId) removeLastRangeFromLocalState(puzzleId);
  }, [puzzleId]);

  const clearRanges = useCallback(() => {
    // Clearing ranges independently of guesses is not needed for anonymous
    // users today; storage is cleared wholesale on puzzle change.
  }, []);

  const markComplete = useCallback(
    (hasWon: boolean) => {
      if (!puzzleId) return;
      const currentGuesses = getStorageSnapshot(puzzleId);
      updateStorage(puzzleId, currentGuesses, true, hasWon);
    },
    [puzzleId],
  );

  return {
    sessionGuesses,
    sessionRanges,
    addGuess,
    addRange,
    replaceLastRange,
    removeLastRange,
    clearGuesses,
    clearRanges,
    markComplete,
  };
}
