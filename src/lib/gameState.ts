// Game State Management for Chrondle
// Static puzzle database with pre-curated historical events

import { logger } from "./logger";
import { Id } from "convex/_generated/dataModel";
import { Puzzle } from "@/types/puzzle";
// Storage imports removed - using in-memory state only
// Authenticated users should use Convex for persistence

// Re-export canonical Puzzle type for backward compatibility
export type { Puzzle } from "@/types/puzzle";

export interface GameState {
  puzzle: Puzzle | null;
  guesses: number[];
  maxGuesses: number;
  isGameOver: boolean;
}

export interface Progress {
  guesses: number[];
  isGameOver: boolean;
  puzzleId: Id<"puzzles"> | null;
  puzzleYear: number | null;
  timestamp: string;
  // Closest guess tracking for enhanced sharing
  closestGuess?: number;
  closestDistance?: number;
}

export interface GameSettings {
  darkMode: boolean;
  colorBlindMode: boolean;
}

// Create initial game state
export function createInitialGameState(): GameState {
  return {
    puzzle: null,
    guesses: [],
    maxGuesses: 6,
    isGameOver: false,
  };
}

// Local Storage Management
// Note: getDailyYear() and initializePuzzle() were deprecated and removed in favor of Convex-based puzzle loading
// Migration: Use useRangeGame hook which calls Convex getDailyPuzzle query
export function getStorageKey(): string {
  const today = new Date();
  const dateString = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const storageKey = `chrondle-progress-${dateString}`;
  logger.debug(`Storage key generated: ${storageKey}`);
  return storageKey;
}

export function saveProgress(
  gameState: GameState,
  isDebugMode?: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _archiveYear?: number,
): boolean {
  if (isDebugMode) {
    logger.debug("Debug mode: skipping localStorage save");
    return true;
  }

  // Calculate closest guess for persistence
  let closestGuess: number | undefined;
  let closestDistance: number | undefined;

  if (gameState.guesses.length > 0 && gameState.puzzle) {
    try {
      let bestDistance = Infinity;
      let bestGuess = gameState.guesses[0];

      for (const guess of gameState.guesses) {
        const distance = Math.abs(guess - gameState.puzzle.targetYear);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestGuess = guess;
        }
      }

      closestGuess = bestGuess;
      closestDistance = bestDistance;
    } catch (error) {
      logger.warn("Failed to calculate closest guess for save:", error);
    }
  }

  const progress: Progress = {
    guesses: gameState.guesses,
    isGameOver: gameState.isGameOver,
    puzzleId: gameState.puzzle ? gameState.puzzle.id : null,
    puzzleYear: gameState.puzzle ? gameState.puzzle.targetYear : null,
    timestamp: new Date().toISOString(),
    closestGuess,
    closestDistance,
  };

  logger.debug(`Saving progress:`, progress);

  // No localStorage persistence - authenticated users use Convex
  logger.debug("Progress save skipped - no localStorage persistence");

  return false;
}

export function loadProgress(gameState: GameState, isDebugMode?: boolean): void {
  if (isDebugMode) {
    logger.debug("Debug mode: skipping localStorage load");
    return;
  }

  if (typeof window === "undefined") return;

  // No localStorage persistence - authenticated users use Convex
  logger.debug("Progress load skipped - no localStorage persistence");

  // Always start with fresh state for anonymous users
  gameState.guesses = [];
  gameState.isGameOver = false;
}

// Settings Management
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function saveSettings(_settings: GameSettings): void {
  // No localStorage persistence - settings should be stored in Convex for authenticated users
  logger.debug("Settings save skipped - no localStorage persistence");
}

export function loadSettings(): GameSettings | null {
  // No localStorage persistence - settings should be loaded from Convex for authenticated users
  logger.debug("Settings load skipped - no localStorage persistence");
  return null;
}

// Storage cleanup
export function cleanupOldStorage(): void {
  // No localStorage to clean up
  logger.debug("Storage cleanup skipped - no localStorage persistence");
}

// Mark first time player
export function markFirstTimePlayer(): void {
  // No localStorage tracking - use Convex for user state
  logger.debug("First time player tracking skipped - use Convex");
}

// Check if player has played before
export function hasPlayedBefore(): boolean {
  // No localStorage tracking - use Convex for user state
  logger.debug("Player history check skipped - use Convex");
  return false;
}
