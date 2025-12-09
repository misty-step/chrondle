/**
 * Pure functions for countdown time calculation
 *
 * Extracted from useCountdown hook to enable direct testing without timer mocking.
 * All functions are pure - no side effects, no React state.
 */

import { formatCountdown, getTimeUntilMidnight } from "@/lib/displayFormatting";

/**
 * Input for countdown calculation
 */
export interface CountdownCalculationInput {
  /** Target timestamp in Unix milliseconds */
  targetTimestamp: number | undefined;
  /** Whether to use local midnight fallback when target is unavailable */
  enableFallback: boolean;
}

/**
 * Result of countdown calculation
 */
export interface CountdownCalculationResult {
  /** Formatted time string (HH:MM:SS) or error placeholder */
  timeString: string;
  /** Milliseconds remaining (negative if past) */
  remaining: number;
  /** Whether countdown has completed */
  isComplete: boolean;
  /** Error message if calculation couldn't proceed normally */
  error: string | null;
}

/**
 * Calculate countdown time from target timestamp
 *
 * Pure function - all inputs explicit, no side effects.
 *
 * @param input - Target timestamp and fallback settings
 * @param now - Current timestamp (injectable for testing)
 * @returns Calculation result with formatted time and state
 *
 * @example
 * const result = calculateCountdownTime(
 *   { targetTimestamp: Date.now() + 3600000, enableFallback: true },
 *   Date.now()
 * );
 * // result.timeString = "01:00:00"
 * // result.remaining = 3600000
 * // result.isComplete = false
 */
export function calculateCountdownTime(
  input: CountdownCalculationInput,
  now: number = Date.now(),
): CountdownCalculationResult {
  const { targetTimestamp, enableFallback } = input;

  let remaining: number;
  let error: string | null = null;

  if (targetTimestamp !== undefined) {
    // Use provided timestamp
    remaining = targetTimestamp - now;
  } else if (enableFallback) {
    // Fallback to local midnight calculation
    remaining = getTimeUntilMidnight();
    error = "Using local countdown - server timing unavailable";
  } else {
    // No fallback, error state
    return {
      timeString: "--:--:--",
      remaining: 0,
      isComplete: false,
      error: "Countdown unavailable",
    };
  }

  // Handle completion
  if (remaining <= 0) {
    return {
      timeString: "00:00:00",
      remaining: 0,
      isComplete: true,
      error,
    };
  }

  // Format remaining time
  return {
    timeString: formatCountdown(remaining),
    remaining,
    isComplete: false,
    error,
  };
}

/**
 * Determine if countdown state should trigger completion callback
 *
 * Pure function to decide if completion event should fire.
 * Prevents repeated firing on same completion.
 *
 * @param current - Current calculation result
 * @param wasComplete - Previous completion state
 * @returns Whether to fire completion callback
 */
export function shouldTriggerCompletion(
  current: CountdownCalculationResult,
  wasComplete: boolean,
): boolean {
  return current.isComplete && !wasComplete;
}

/**
 * Determine if countdown state transitioned from complete to incomplete
 *
 * This happens when a new target arrives after previous countdown completed.
 *
 * @param current - Current calculation result
 * @param wasComplete - Previous completion state
 * @returns Whether countdown restarted after completion
 */
export function didCountdownRestart(
  current: CountdownCalculationResult,
  wasComplete: boolean,
): boolean {
  return !current.isComplete && wasComplete;
}
