/**
 * Pure validation functions for game submissions
 *
 * Extracted from useGameActions to enable direct testing.
 * All functions are pure - no side effects, no React state.
 */

import { GAME_CONFIG } from "@/lib/constants";
import { SCORING_CONSTANTS } from "@/lib/scoring";

/**
 * Validation error with field and message
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result of validation - either success or errors
 */
export type ValidationResult = { valid: true } | { valid: false; errors: ValidationError[] };

/**
 * Validate a single guess submission
 *
 * @param guess - The year to validate
 * @param currentGuessCount - Number of guesses already made
 * @param currentYear - Current calendar year (for upper bound)
 * @returns Validation result
 *
 * @example
 * const result = validateGuessSubmission(1969, 0, 2025);
 * // result = { valid: true }
 *
 * const result2 = validateGuessSubmission(3000, 0, 2025);
 * // result2 = { valid: false, errors: [{ field: "guess", message: "..." }] }
 */
export function validateGuessSubmission(
  guess: number,
  currentGuessCount: number,
  currentYear: number = new Date().getFullYear(),
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check year bounds
  if (guess < -9999 || guess > currentYear) {
    errors.push({
      field: "guess",
      message: `Please enter a year between -9999 and ${currentYear}`,
    });
  }

  // Check max guesses
  if (currentGuessCount >= GAME_CONFIG.MAX_GUESSES) {
    errors.push({
      field: "guessCount",
      message: "You've used all 6 guesses for this puzzle",
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate a range submission
 *
 * @param start - Start year of range
 * @param end - End year of range
 * @param currentRangeCount - Number of ranges already submitted (optional)
 * @returns Validation result
 *
 * @example
 * const result = validateRangeSubmission(1960, 1980);
 * // result = { valid: true }
 *
 * const result2 = validateRangeSubmission(1980, 1960);
 * // result2 = { valid: false, errors: [{ field: "range", message: "..." }] }
 */
export function validateRangeSubmission(
  start: number,
  end: number,
  currentRangeCount?: number,
): ValidationResult {
  const errors: ValidationError[] = [];

  // Check start before end
  if (start > end) {
    errors.push({
      field: "range",
      message: "Start year must be before end year",
    });
    // Early return - other validations don't make sense
    return { valid: false, errors };
  }

  const width = end - start + 1;
  // Note: width >= 1 is guaranteed because we already checked start <= end

  // Check maximum width
  if (width > SCORING_CONSTANTS.W_MAX) {
    errors.push({
      field: "width",
      message: `Range must be ${SCORING_CONSTANTS.W_MAX} years or narrower`,
    });
  }

  // Optional: check max ranges if provided
  if (currentRangeCount !== undefined && currentRangeCount >= GAME_CONFIG.MAX_GUESSES) {
    errors.push({
      field: "rangeCount",
      message: "You've used all ranges for this puzzle",
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Calculate range width
 *
 * @param start - Start year
 * @param end - End year
 * @returns Width in years (inclusive)
 */
export function calculateRangeWidth(start: number, end: number): number {
  return end - start + 1;
}

/**
 * Check if a range contains a target year
 *
 * @param start - Start year of range
 * @param end - End year of range
 * @param target - Target year to check
 * @returns True if target is within range (inclusive)
 */
export function rangeContainsTarget(start: number, end: number, target: number): boolean {
  return target >= start && target <= end;
}

/**
 * Normalize hint count to valid range
 *
 * @param hintsUsed - Raw hint count
 * @returns Clamped hint count within valid bounds
 */
export function normalizeHintCount(hintsUsed: number): number {
  const maxHintLevel = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS.length - 1;
  return Math.max(0, Math.min(maxHintLevel, hintsUsed));
}
