/**
 * Puzzle Type Classification
 *
 * CRITICAL BUSINESS RULE: Archive puzzles don't update streaks
 *
 * This module provides type-safe classification of puzzles as "daily" or "archive"
 * to enforce the business rule that only today's daily puzzle should affect user streaks.
 *
 * DAY SEMANTICS: Chrondle's canonical "today" is the PLAYER'S local calendar
 * day (see src/lib/time/dailyDate.ts). Clients resolve their daily puzzle by
 * local date, so the daily puzzle a player legitimately completes can carry a
 * date up to one day away from the server's UTC date (timezone envelope
 * UTC-12..UTC+14). A puzzle is therefore classified "daily" when its date is
 * within one day of the server's UTC date; anything further out is archive.
 *
 * Implementation: Classification is derived from puzzle date vs. current date,
 * ensuring a single source of truth with no possibility of type/date mismatch.
 */

import { dayDifference, getUTCDateString } from "./streakCalculation";

/**
 * Discriminated union for puzzle classification
 *
 * - daily: Today's puzzle (affects streaks)
 * - archive: Historical puzzle (doesn't affect streaks)
 */
export type PuzzleType = { type: "daily"; date: string } | { type: "archive"; date: string };

/**
 * Classify a puzzle as daily or archive based on its date
 *
 * This is the single source of truth for puzzle classification.
 * Used throughout the codebase to enforce streak update rules.
 *
 * @param puzzleDate - ISO date string (YYYY-MM-DD) from puzzle.date
 * @param currentDate - Optional current date for comparison (defaults to UTC now)
 *                      Pass this to prevent midnight rollover race conditions
 * @returns Discriminated union with type and date
 *
 * @example
 * // Basic usage (race-vulnerable if called multiple times)
 * const classification = classifyPuzzle("2025-10-16");
 * if (classification.type === "daily") {
 *   // Update streak
 * } else {
 *   // Skip streak update for archive
 * }
 *
 * @example
 * // Safe usage (race-free - recommended for streak updates)
 * const today = getUTCDateString();
 * const classification = classifyPuzzle("2025-10-16", today);
 * // Use same 'today' for subsequent streak calculations
 */
export function classifyPuzzle(puzzleDate: string, currentDate?: string): PuzzleType {
  const today = currentDate ?? getUTCDateString();

  // Daily = within the timezone envelope of the server's UTC day. A player's
  // local "today" (the canonical day; see module doc) is always within one
  // day of UTC, so |diff| <= 1 admits every legitimate daily play and rejects
  // all genuinely historical puzzles.
  if (Math.abs(dayDifference(today, puzzleDate)) <= 1) {
    return { type: "daily", date: puzzleDate };
  } else {
    return { type: "archive", date: puzzleDate };
  }
}

/**
 * Type guard to check if puzzle is today's daily puzzle
 *
 * @param classification - Puzzle classification from classifyPuzzle()
 * @returns true if puzzle is today's daily puzzle
 *
 * @example
 * const classification = classifyPuzzle(puzzle.date);
 * if (isDailyPuzzle(classification)) {
 *   await updateUserStreak(ctx, userId, puzzleDate, hasWon);
 * }
 */
export function isDailyPuzzle(classification: PuzzleType): boolean {
  return classification.type === "daily";
}

/**
 * Type guard to check if puzzle is an archive puzzle
 *
 * @param classification - Puzzle classification from classifyPuzzle()
 * @returns true if puzzle is an archive/historical puzzle
 *
 * @example
 * const classification = classifyPuzzle(puzzle.date);
 * if (isArchivePuzzle(classification)) {
 *   console.log("Archive puzzle - streak not affected");
 * }
 */
export function isArchivePuzzle(classification: PuzzleType): boolean {
  return classification.type === "archive";
}
