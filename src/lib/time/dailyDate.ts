/**
 * Daily Date Module — THE canonical day-resolution module
 *
 * Chrondle's canonical "today" is the PLAYER'S LOCAL CALENDAR DAY. Every
 * user-facing daily surface derives its day from this module: the homepage
 * gallery and game pages (via useTodaysPuzzle / useTodaysOrderPuzzle), the
 * archive today-boundary, the next-puzzle countdown (local midnight), and the
 * optimistic streak day marker. Server-side streak boundaries derive from the
 * puzzle's date, which is itself resolved from this module by the client.
 *
 * Do NOT resolve a UI "today" any other way — in particular, never from a
 * server clock. The UTC-day Convex queries (getDailyPuzzle /
 * getDailyOrderPuzzle) are quarantined and lint-banned in src/. See the
 * "Daily Day Semantics" section of README.md for the full rationale.
 *
 * Deep Module: Hides timezone complexity behind simple date string interface.
 *
 * Key Decisions:
 * - Derives from Date local fields (getFullYear/getMonth/getDate)
 * - No Intl dependency; stable per local calendar day
 * - Pure functions, no throws
 */

/**
 * Get local date string in YYYY-MM-DD format
 *
 * Uses browser's local timezone to determine "today"
 *
 * @param now - Optional Date to use (defaults to current time, injectable for testing)
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * getLocalDateString() // "2024-03-15" (depends on local timezone)
 * getLocalDateString(new Date("2024-01-01T23:30:00-08:00")) // "2024-01-01"
 */
export function getLocalDateString(now: Date = new Date()): string {
  // Guard against invalid dates - return fallback silently
  if (Number.isNaN(now.getTime())) {
    return "0000-00-00";
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Get UTC date string in YYYY-MM-DD format
 *
 * Thin wrapper for server-side date operations
 *
 * @param now - Optional Date to use (defaults to current time)
 * @returns Date string in YYYY-MM-DD format based on UTC
 *
 * @example
 * getUTCDateString() // "2024-03-15" (depends on UTC time)
 */
export function getUTCDateString(now: Date = new Date()): string {
  // Guard against invalid dates - return fallback silently
  if (Number.isNaN(now.getTime())) {
    return "0000-00-00";
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Check if two date strings are equal
 *
 * @param date1 - First date string (YYYY-MM-DD)
 * @param date2 - Second date string (YYYY-MM-DD)
 * @returns True if dates are equal
 */
export function areDatesEqual(date1: string, date2: string): boolean {
  return date1 === date2;
}

/**
 * Calculate milliseconds until local midnight
 *
 * @param now - Optional current Date (injectable for testing)
 * @returns Milliseconds until 00:00:00 local time
 */
export function getMillisUntilLocalMidnight(now: Date = new Date()): number {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}
