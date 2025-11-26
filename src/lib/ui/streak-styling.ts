/**
 * Streak UI Styling Module
 * Provides visual styling helpers for streak display
 */

/**
 * Color classes for streak display with optional milestone messages
 */
export interface StreakColorClasses {
  textColor: string;
  borderColor: string;
  milestone?: string;
}

/**
 * Calculates Tailwind color classes based on streak length
 * Progressive color system rewards longer streaks with more vibrant colors
 *
 * Streak Tiers:
 * - 0: Muted (no active streak)
 * - 1-2: Foreground (starting out)
 * - 3-6: Info blue (building momentum)
 * - 7-13: Success green (one week+)
 * - 14-29: Warning amber (two weeks+)
 * - 30-99: Error red (one month+)
 * - 100+: Primary (elite status)
 *
 * @param streak - Current streak count (days)
 * @returns Color classes and optional milestone message
 *
 * @example
 * getStreakColorClasses(0);
 * // { textColor: "text-muted-foreground", borderColor: "border-muted" }
 *
 * @example
 * getStreakColorClasses(7);
 * // { textColor: "text-feedback-correct", borderColor: "border-muted", milestone: "One week streak! 🔥" }
 *
 * @example
 * getStreakColorClasses(100);
 * // { textColor: "text-body-primary", borderColor: "border-muted", milestone: "Century club! 👑" }
 */
export function getStreakColorClasses(streak: number): StreakColorClasses {
  if (streak <= 0) {
    return {
      textColor: "text-muted-foreground",
      borderColor: "border-muted",
    };
  }

  if (streak <= 2) {
    return {
      textColor: "text-foreground",
      borderColor: "border-muted",
    };
  }

  if (streak <= 6) {
    return {
      textColor: "text-status-info",
      borderColor: "border-muted",
      milestone: streak === 3 ? "Building momentum!" : undefined,
    };
  }

  if (streak <= 13) {
    return {
      textColor: "text-feedback-correct",
      borderColor: "border-muted",
      milestone: streak === 7 ? "One week streak! 🔥" : undefined,
    };
  }

  if (streak <= 29) {
    return {
      textColor: "text-status-warning",
      borderColor: "border-muted",
      milestone: streak === 14 ? "Two weeks strong! ⚡" : undefined,
    };
  }

  if (streak <= 99) {
    return {
      textColor: "text-status-error",
      borderColor: "border-muted",
      milestone:
        streak === 30
          ? "One month champion! 🏆"
          : streak === 50
            ? "Incredible dedication! 💎"
            : undefined,
    };
  }

  // 100+ days - Elite status
  return {
    textColor: "text-body-primary",
    borderColor: "border-muted",
    milestone: streak === 100 ? "Century club! 👑" : undefined,
  };
}
