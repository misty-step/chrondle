/**
 * Canonical Puzzle type definitions for Chrondle
 *
 * This module provides the single source of truth for puzzle data structures.
 * All puzzle-related code should import from this module to ensure type consistency.
 *
 * Design Principles:
 * - Clear, non-overlapping field names (no year vs targetYear confusion)
 * - Strong typing (no string | Id union types)
 * - Aligned with Convex backend schema
 */

import { Id } from "convex/_generated/dataModel";

/**
 * Canonical Puzzle interface representing a daily historical guessing game.
 *
 * This interface is the single source of truth for puzzle data throughout the application.
 * It aligns with the Convex backend schema and eliminates legacy type confusion.
 *
 * @property id - Convex ID for the puzzle (always Id<"puzzles">, never string)
 * @property targetYear - The year players need to guess (replaces ambiguous "year" field)
 * @property events - Array of 6 historical events ordered from obscure to obvious
 * @property puzzleNumber - Sequential puzzle number for display and sharing
 *
 * @example
 * const puzzle: Puzzle = {
 *   id: "j97h5s1g4m9n8b7c6d5e4f3g2h1" as Id<"puzzles">,
 *   targetYear: 1969,
 *   events: [
 *     "The Stonewall riots began in New York City",
 *     "Woodstock music festival took place",
 *     "Neil Armstrong walked on the moon"
 *   ],
 *   puzzleNumber: 42
 * };
 */
export interface Puzzle {
  /** Convex database ID - always Id<"puzzles">, never string */
  id: Id<"puzzles">;

  /** The year players must guess - renamed from "year" for clarity */
  targetYear: number;

  /** Historical events ordered from obscure to obvious (always 6 events) */
  events: string[];

  /** Sequential puzzle number for display (e.g., "Puzzle #42") */
  puzzleNumber: number;

  /** ISO date string (YYYY-MM-DD) when this puzzle was scheduled */
  date?: string;
}

/**
 * Extended puzzle data with optional historical context
 *
 * Used when displaying completed puzzles with AI-generated historical narratives.
 *
 * @property historicalContext - Optional AI-generated narrative about the year's significance
 *
 * @example
 * const completedPuzzle: PuzzleWithContext = {
 *   ...puzzle,
 *   historicalContext: "1969 was a transformative year marked by..."
 * };
 */
export interface PuzzleWithContext extends Puzzle {
  /** AI-generated historical narrative about the target year */
  historicalContext?: string;
}

/**
 * Type guard to check if a puzzle has historical context
 *
 * @param puzzle - The puzzle to check
 * @returns True if the puzzle has historical context
 *
 * @example
 * if (hasHistoricalContext(puzzle)) {
 *   logger.debug(puzzle.historicalContext);
 * }
 */
export function hasHistoricalContext(
  puzzle: Puzzle | PuzzleWithContext,
): puzzle is PuzzleWithContext {
  return "historicalContext" in puzzle && puzzle.historicalContext !== undefined;
}

/**
 * Validates that a puzzle has all required fields with correct types
 *
 * @param puzzle - The puzzle to validate
 * @returns True if the puzzle is valid
 *
 * @example
 * if (!isValidPuzzle(puzzle)) {
 *   throw new Error("Invalid puzzle data");
 * }
 */
export function isValidPuzzle(puzzle: unknown): puzzle is Puzzle {
  if (typeof puzzle !== "object" || puzzle === null) {
    return false;
  }

  const p = puzzle as Partial<Puzzle>;

  return (
    typeof p.id === "string" &&
    typeof p.targetYear === "number" &&
    Array.isArray(p.events) &&
    p.events.length === 6 &&
    p.events.every((e) => typeof e === "string") &&
    typeof p.puzzleNumber === "number" &&
    p.puzzleNumber > 0
  );
}
