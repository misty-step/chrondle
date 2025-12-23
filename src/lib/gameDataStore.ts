/**
 * Game Data Store - Auth-agnostic local data layer
 *
 * This module provides a "deep" abstraction for game data persistence that:
 * 1. Always writes to localStorage (fire-and-forget buffer)
 * 2. Always reads from localStorage (no auth check)
 * 3. Provides explicit migration function for server sync
 *
 * The key insight: localStorage is a write buffer, not an "anonymous-only" store.
 * Auth state controls WHERE we source truth from, not WHETHER we persist locally.
 */

import { gameStateStorage, rangeGuessSchema } from "@/lib/secureStorage";
import { logger } from "@/lib/logger";
import type { RangeGuess } from "@/types/range";
import { z } from "zod";

/**
 * Local game state structure
 * Matches the schema in secureStorage.ts but with explicit types
 */
export interface LocalGameState {
  puzzleId: string;
  guesses: number[];
  ranges: RangeGuess[];
  isComplete: boolean;
  hasWon: boolean;
  timestamp: number;
}

/**
 * Data to migrate to server when user authenticates
 */
export interface MigrationData {
  puzzleId: string;
  guesses: number[];
  ranges: RangeGuess[];
  isComplete: boolean;
  hasWon: boolean;
}

/**
 * Read game state from localStorage
 * NO auth check - always reads what's stored
 *
 * @param puzzleId - Optional puzzle ID to validate against
 * @returns Local game state or null if not found/invalid
 */
export function readLocalGameState(puzzleId?: string): LocalGameState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = gameStateStorage.get();
  if (!stored) {
    return null;
  }

  // If puzzleId provided, validate it matches
  if (puzzleId && stored.puzzleId !== puzzleId) {
    return null;
  }

  // Normalize the data (ranges might be undefined in old data)
  return {
    puzzleId: stored.puzzleId,
    guesses: stored.guesses || [],
    ranges: (stored.ranges as RangeGuess[]) || [],
    isComplete: stored.isComplete,
    hasWon: stored.hasWon,
    timestamp: stored.timestamp,
  };
}

/**
 * Write game state to localStorage
 * NO auth check - always writes
 *
 * @param state - Game state to persist
 * @returns true if write succeeded
 */
export function writeLocalGameState(state: LocalGameState): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const success = gameStateStorage.set({
    puzzleId: state.puzzleId,
    guesses: state.guesses,
    ranges: state.ranges,
    isComplete: state.isComplete,
    hasWon: state.hasWon,
    timestamp: Date.now(),
  });

  if (success) {
    // Dispatch event for cross-tab sync and useSyncExternalStore
    window.dispatchEvent(new Event("chrondle-storage-change"));
  }

  return success;
}

/**
 * Add a range guess to local state
 * Creates state if it doesn't exist for this puzzle
 *
 * @param puzzleId - Current puzzle ID
 * @param range - Range guess to add
 * @param isComplete - Whether this completes the game
 * @param hasWon - Whether the player won
 * @returns true if write succeeded
 */
export function addRangeToLocalState(
  puzzleId: string,
  range: RangeGuess,
  isComplete: boolean,
  hasWon: boolean,
): boolean {
  const current = readLocalGameState(puzzleId);

  const newState: LocalGameState = {
    puzzleId,
    guesses: current?.guesses || [],
    ranges: [...(current?.ranges || []), range],
    isComplete,
    hasWon,
    timestamp: Date.now(),
  };

  return writeLocalGameState(newState);
}

/**
 * Update the last range in local state (for editing before submit)
 *
 * @param puzzleId - Current puzzle ID
 * @param range - Updated range
 * @returns true if write succeeded
 */
export function updateLastRangeInLocalState(puzzleId: string, range: RangeGuess): boolean {
  const current = readLocalGameState(puzzleId);
  if (!current || current.ranges.length === 0) {
    return false;
  }

  const newRanges = [...current.ranges];
  newRanges[newRanges.length - 1] = range;

  return writeLocalGameState({
    ...current,
    ranges: newRanges,
    timestamp: Date.now(),
  });
}

/**
 * Remove the last range from local state
 *
 * @param puzzleId - Current puzzle ID
 * @returns true if write succeeded
 */
export function removeLastRangeFromLocalState(puzzleId: string): boolean {
  const current = readLocalGameState(puzzleId);
  if (!current || current.ranges.length === 0) {
    return false;
  }

  return writeLocalGameState({
    ...current,
    ranges: current.ranges.slice(0, -1),
    timestamp: Date.now(),
  });
}

/**
 * Clear local game state
 * Used after successful migration to server
 */
export function clearLocalGameState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const success = gameStateStorage.remove();

  if (success) {
    window.dispatchEvent(new Event("chrondle-storage-change"));
  }

  return success;
}

/**
 * Get migration data from localStorage
 * This is the CRITICAL function that fixes the race condition.
 *
 * It reads localStorage DIRECTLY without any auth check,
 * so it can be called during the migration window before
 * the auth state has fully settled.
 *
 * @returns Migration data or null if nothing to migrate
 */
export function getMigrationData(): MigrationData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = gameStateStorage.get();
  if (!stored) {
    return null;
  }

  // Only return if there's actual data to migrate
  const hasGuesses = stored.guesses && stored.guesses.length > 0;
  const hasRanges = stored.ranges && (stored.ranges as RangeGuess[]).length > 0;

  if (!hasGuesses && !hasRanges) {
    return null;
  }

  return {
    puzzleId: stored.puzzleId,
    guesses: stored.guesses || [],
    ranges: (stored.ranges as RangeGuess[]) || [],
    isComplete: stored.isComplete,
    hasWon: stored.hasWon,
  };
}

/**
 * Check if local state exists (for UI indicators)
 */
export function hasLocalGameState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return gameStateStorage.exists();
}

/**
 * Check if local state has data for a specific puzzle
 */
export function hasLocalGameStateForPuzzle(puzzleId: string): boolean {
  const state = readLocalGameState(puzzleId);
  return state !== null && (state.guesses.length > 0 || state.ranges.length > 0);
}

/**
 * Validate ranges array using Zod schema
 * Used for defensive validation of data from localStorage
 */
export function validateRanges(ranges: unknown): RangeGuess[] {
  try {
    const schema = z.array(rangeGuessSchema);
    return schema.parse(ranges) as RangeGuess[];
  } catch {
    logger.warn("[gameDataStore] Invalid ranges data, returning empty array");
    return [];
  }
}
