/**
 * Pure streak calculation logic shared between client and server
 *
 * This module provides deterministic streak calculation based on UTC dates.
 * It has zero dependencies and handles all edge cases for consecutive day tracking.
 *
 * Module Responsibility: Calculate streaks from dates - the "what" not "how to persist"
 * Hidden Complexity: UTC timezone handling, date comparison edge cases, null handling
 *
 * Design: Uses discriminated unions to make streak update operations explicit.
 * Instead of returning ambiguous numbers, we return self-describing commands.
 */

/**
 * Result of streak calculation - DEPRECATED
 * Use StreakUpdate instead for explicit command semantics
 * @deprecated
 */
export interface StreakCalculationResult {
  currentStreak: number;
  lastCompletedDate: string;
}

/**
 * Explicit streak update operations using discriminated union pattern
 *
 * Each variant represents a different update command with clear semantics.
 * This eliminates ambiguity (e.g., "is 0 a reset or a no-op?") and makes
 * the code self-documenting.
 */
export type StreakUpdate =
  | {
      /** No state change needed - preserves existing streak */
      type: "no-change";
      reason: "same-day-replay";
    }
  | {
      /** Increment streak - consecutive day win */
      type: "increment";
      newStreak: number;
      date: string;
      reason: "consecutive-day-win";
    }
  | {
      /** Reset streak to zero */
      type: "reset";
      date: string;
      reason: "loss" | "missed-days";
    }
  | {
      /** Start new streak at 1 */
      type: "initialize";
      date: string;
      reason: "first-win" | "restart-after-gap";
    };

/**
 * Type guard: Check if update is no-change
 */
export function isNoChange(
  update: StreakUpdate,
): update is Extract<StreakUpdate, { type: "no-change" }> {
  return update.type === "no-change";
}

/**
 * Type guard: Check if update is increment
 */
export function isIncrement(
  update: StreakUpdate,
): update is Extract<StreakUpdate, { type: "increment" }> {
  return update.type === "increment";
}

/**
 * Type guard: Check if update is reset
 */
export function isReset(update: StreakUpdate): update is Extract<StreakUpdate, { type: "reset" }> {
  return update.type === "reset";
}

/**
 * Type guard: Check if update is initialize
 */
export function isInitialize(
  update: StreakUpdate,
): update is Extract<StreakUpdate, { type: "initialize" }> {
  return update.type === "initialize";
}

/**
 * Get current date as UTC string in ISO format (YYYY-MM-DD)
 *
 * @param date - Optional date to convert, defaults to now
 * @returns ISO date string in UTC timezone
 *
 * @example
 * getUTCDateString() // "2025-10-08"
 * getUTCDateString(new Date('2024-12-25')) // "2024-12-25"
 */
export function getUTCDateString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validate ISO date string format
 *
 * @param dateString - Date string to validate
 * @returns true if valid ISO format (YYYY-MM-DD)
 */
function isValidDateString(dateString: string): boolean {
  if (!dateString || typeof dateString !== "string") {
    return false;
  }

  // Check format: YYYY-MM-DD
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDatePattern.test(dateString)) {
    return false;
  }

  // Verify it's a real date (not 2024-13-45)
  const date = new Date(dateString + "T00:00:00.000Z");
  return !isNaN(date.getTime()) && getUTCDateString(date) === dateString;
}

/**
 * Signed difference in whole days between two ISO date strings (b - a)
 *
 * @param a - First date (ISO string YYYY-MM-DD)
 * @param b - Second date (ISO string YYYY-MM-DD)
 * @returns Number of days from a to b (positive if b is after a)
 *
 * @throws Error if date strings are invalid
 *
 * @example
 * dayDifference("2025-10-07", "2025-10-08") // 1
 * dayDifference("2025-10-08", "2025-10-07") // -1
 * dayDifference("2025-10-08", "2025-10-08") // 0
 */
export function dayDifference(a: string, b: string): number {
  if (!isValidDateString(a)) {
    throw new Error(`Invalid first date: ${a}`);
  }
  if (!isValidDateString(b)) {
    throw new Error(`Invalid second date: ${b}`);
  }

  const first = new Date(a + "T00:00:00.000Z").getTime();
  const second = new Date(b + "T00:00:00.000Z").getTime();
  return Math.round((second - first) / 86_400_000);
}

/**
 * Check if two dates are consecutive (second date is exactly one day after first)
 *
 * @param firstDate - Earlier date (ISO string YYYY-MM-DD)
 * @param secondDate - Later date (ISO string YYYY-MM-DD)
 * @returns true if secondDate is exactly one day after firstDate
 *
 * @throws Error if date strings are invalid
 *
 * @example
 * isConsecutiveDay("2025-10-07", "2025-10-08") // true
 * isConsecutiveDay("2025-10-07", "2025-10-09") // false (gap)
 * isConsecutiveDay("2025-10-07", "2025-10-07") // false (same day)
 */
export function isConsecutiveDay(firstDate: string, secondDate: string): boolean {
  if (!isValidDateString(firstDate)) {
    throw new Error(`Invalid first date: ${firstDate}`);
  }
  if (!isValidDateString(secondDate)) {
    throw new Error(`Invalid second date: ${secondDate}`);
  }

  // Parse both dates in UTC
  const first = new Date(firstDate + "T00:00:00.000Z");
  const second = new Date(secondDate + "T00:00:00.000Z");

  // Calculate expected next day
  const expectedNext = new Date(first);
  expectedNext.setUTCDate(expectedNext.getUTCDate() + 1);

  // Compare UTC timestamps (ignores time component since we set to 00:00:00)
  return getUTCDateString(expectedNext) === getUTCDateString(second);
}

/**
 * Calculate streak based on last completion date and current game result
 *
 * This is a pure function with deterministic output based solely on inputs.
 *
 * Rules:
 * - First play (null lastCompletedDate) + win → streak = 1
 * - First play (null lastCompletedDate) + loss → streak = 0
 * - Same day completion (todayDate === lastCompletedDate) → no change, return { currentStreak: 0, lastCompletedDate }
 * - Consecutive day (yesterday) + win → streak + 1
 * - Consecutive day (yesterday) + loss → streak = 0
 * - Gap (>1 day) + win → reset to 1
 * - Gap (>1 day) + loss → reset to 0
 *
 * @param lastCompletedDate - Date of last puzzle completion (ISO YYYY-MM-DD) or null
 * @param currentStreak - Current streak count before this game
 * @param todayDate - Date of current game completion (ISO YYYY-MM-DD)
 * @param hasWon - Whether the player won this game
 * @returns New streak count and completion date
 *
 * @throws Error if date strings are invalid format
 *
 * @example
 * // First play, won
 * calculateStreak(null, 0, "2025-10-08", true)
 * // → { currentStreak: 1, lastCompletedDate: "2025-10-08" }
 *
 * @example
 * // Consecutive day, won
 * calculateStreak("2025-10-07", 5, "2025-10-08", true)
 * // → { currentStreak: 6, lastCompletedDate: "2025-10-08" }
 *
 * @example
 * // Same day (already played today)
 * calculateStreak("2025-10-08", 3, "2025-10-08", true)
 * // → { currentStreak: 0, lastCompletedDate: "2025-10-08" }
 *
 * @example
 * // Gap, reset
 * calculateStreak("2025-10-05", 10, "2025-10-08", true)
 * // → { currentStreak: 1, lastCompletedDate: "2025-10-08" }
 *
 * @example
 * // Lost game
 * calculateStreak("2025-10-07", 5, "2025-10-08", false)
 * // → { currentStreak: 0, lastCompletedDate: "2025-10-08" }
 */
export function calculateStreak(
  lastCompletedDate: string | null,
  currentStreak: number,
  todayDate: string,
  hasWon: boolean,
): StreakCalculationResult {
  // Validate today's date
  if (!isValidDateString(todayDate)) {
    throw new Error(`Invalid today date: ${todayDate}`);
  }

  // If player lost, reset streak to 0
  if (!hasWon) {
    return {
      currentStreak: 0,
      lastCompletedDate: todayDate,
    };
  }

  // First play ever - start streak at 1
  if (!lastCompletedDate) {
    return {
      currentStreak: 1,
      lastCompletedDate: todayDate,
    };
  }

  // Validate last completed date
  if (!isValidDateString(lastCompletedDate)) {
    throw new Error(`Invalid last completed date: ${lastCompletedDate}`);
  }

  // Same day - already played today, return special marker
  // The caller should handle this by not updating the streak
  if (lastCompletedDate === todayDate) {
    return {
      currentStreak: 0, // Signal: no update needed
      lastCompletedDate: todayDate,
    };
  }

  // Check if consecutive day (yesterday → today)
  if (isConsecutiveDay(lastCompletedDate, todayDate)) {
    return {
      currentStreak: currentStreak + 1,
      lastCompletedDate: todayDate,
    };
  }

  // Gap detected - reset streak to 1
  return {
    currentStreak: 1,
    lastCompletedDate: todayDate,
  };
}

/**
 * Calculate streak update using explicit discriminated union pattern
 *
 * This function returns a self-describing command that states exactly what
 * should happen to the streak. No ambiguous return values, no hidden semantics.
 *
 * @param lastCompletedDate - Date of last puzzle completion (ISO YYYY-MM-DD) or null
 * @param currentStreak - Current streak count before this game
 * @param todayDate - Date of current game completion (ISO YYYY-MM-DD)
 * @param hasWon - Whether the player won this game
 * @returns Explicit update command describing what should happen
 *
 * @throws Error if date strings are invalid format
 *
 * @example Same-day replay - no state change
 * calculateStreakUpdate("2025-10-09", 5, "2025-10-09", true)
 * // → { type: 'no-change', reason: 'same-day-replay' }
 *
 * @example Consecutive day win - increment
 * calculateStreakUpdate("2025-10-08", 5, "2025-10-09", true)
 * // → { type: 'increment', newStreak: 6, date: "2025-10-09", reason: 'consecutive-day-win' }
 *
 * @example Player lost - reset
 * calculateStreakUpdate("2025-10-08", 5, "2025-10-09", false)
 * // → { type: 'reset', date: "2025-10-09", reason: 'loss' }
 *
 * @example First win ever - initialize
 * calculateStreakUpdate(null, 0, "2025-10-09", true)
 * // → { type: 'initialize', date: "2025-10-09", reason: 'first-win' }
 *
 * @example Gap detected - restart
 * calculateStreakUpdate("2025-10-05", 10, "2025-10-09", true)
 * // → { type: 'initialize', date: "2025-10-09", reason: 'restart-after-gap' }
 */
export function calculateStreakUpdate(
  lastCompletedDate: string | null,
  currentStreak: number,
  todayDate: string,
  hasWon: boolean,
): StreakUpdate {
  // Validate today's date
  if (!isValidDateString(todayDate)) {
    throw new Error(`Invalid today date: ${todayDate}`);
  }

  // Same-day replay: No state change needed
  // This is the fix for the bug - we explicitly return "no-change" instead of 0
  if (lastCompletedDate === todayDate) {
    return {
      type: "no-change",
      reason: "same-day-replay",
    };
  }

  // Player lost: Reset streak to zero
  if (!hasWon) {
    return {
      type: "reset",
      date: todayDate,
      reason: "loss",
    };
  }

  // First play ever: Initialize streak at 1
  if (!lastCompletedDate) {
    return {
      type: "initialize",
      date: todayDate,
      reason: "first-win",
    };
  }

  // Validate last completed date
  if (!isValidDateString(lastCompletedDate)) {
    throw new Error(`Invalid last completed date: ${lastCompletedDate}`);
  }

  // Consecutive day win: Increment streak
  if (isConsecutiveDay(lastCompletedDate, todayDate)) {
    return {
      type: "increment",
      newStreak: currentStreak + 1,
      date: todayDate,
      reason: "consecutive-day-win",
    };
  }

  // Gap detected (missed days): Restart streak at 1
  return {
    type: "initialize",
    date: todayDate,
    reason: "restart-after-gap",
  };
}

/**
 * Apply streak update to current state
 *
 * Converts an update command from calculateStreakUpdate into an actual
 * state change. This separates "what to do" from "how to do it".
 *
 * @param currentState - Current streak state before update
 * @param update - Update command from calculateStreakUpdate
 * @returns New streak state after applying update
 *
 * @example Preserve state on no-change
 * applyStreakUpdate(
 *   { currentStreak: 5, lastCompletedDate: "2025-10-09" },
 *   { type: 'no-change', reason: 'same-day-replay' }
 * )
 * // → { currentStreak: 5, lastCompletedDate: "2025-10-09" }
 *
 * @example Apply increment
 * applyStreakUpdate(
 *   { currentStreak: 5, lastCompletedDate: "2025-10-08" },
 *   { type: 'increment', newStreak: 6, date: "2025-10-09", reason: 'consecutive-day-win' }
 * )
 * // → { currentStreak: 6, lastCompletedDate: "2025-10-09" }
 */
export function applyStreakUpdate(
  currentState: { currentStreak: number; lastCompletedDate: string | null },
  update: StreakUpdate,
): { currentStreak: number; lastCompletedDate: string } {
  switch (update.type) {
    case "no-change":
      // Preserve existing state - no changes
      return {
        currentStreak: currentState.currentStreak,
        lastCompletedDate: currentState.lastCompletedDate || "",
      };

    case "increment":
      // Apply the incremented streak value
      return {
        currentStreak: update.newStreak,
        lastCompletedDate: update.date,
      };

    case "reset":
      // Reset streak to zero
      return {
        currentStreak: 0,
        lastCompletedDate: update.date,
      };

    case "initialize":
      // Start new streak at 1
      return {
        currentStreak: 1,
        lastCompletedDate: update.date,
      };

    default:
      // TypeScript exhaustiveness check - will error if we miss a case
      const _exhaustive: never = update;
      throw new Error(`Unhandled update type: ${(_exhaustive as StreakUpdate).type}`);
  }
}
