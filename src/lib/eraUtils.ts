/**
 * Era conversion utilities for BC/AD date handling
 * Provides bidirectional conversion between internal representation (negative for BC)
 * and UI representation (positive year + era flag)
 */

import { GAME_CONFIG } from "./constants";
import { logger } from "@/lib/logger";

export type Era = "BC" | "AD";

export interface EraYear {
  year: number; // Always positive in UI
  era: Era;
}

/**
 * Converts UI representation (positive year + era) to internal format (negative for BC)
 * @param year - Positive year value from UI
 * @param era - Era designation ('BC' or 'AD')
 * @returns Internal year representation (negative for BC, positive for AD)
 * @throws {Error} If year is not a valid number
 */
export function convertToInternalYear(year: number, era: Era): number {
  try {
    // Validate input is a number
    if (typeof year !== "number" || isNaN(year)) {
      throw new Error(`Invalid year value: ${year}`);
    }

    // Validate input
    if (year < 0) {
      logger.warn("convertToInternalYear: Year should be positive in UI representation");
      year = Math.abs(year);
    }

    if (era === "BC") {
      // BC years are stored as negative internally
      // Year 0 doesn't exist historically, but we handle it for consistency
      return year === 0 ? 0 : -year;
    }

    // AD years remain positive
    return year;
  } catch (error) {
    logger.error("Era conversion error:", error);
    // Return a safe default (current year) if conversion fails
    return new Date().getFullYear();
  }
}

/**
 * Converts internal representation (negative for BC) to UI format (positive + era)
 * @param internalYear - Internal year (negative for BC, positive for AD)
 * @returns Object with positive year and era designation
 */
export function convertFromInternalYear(internalYear: number): EraYear {
  if (internalYear < 0) {
    return {
      year: Math.abs(internalYear),
      era: "BC",
    };
  }

  // Year 0 and positive years are treated as AD
  return {
    year: internalYear,
    era: "AD",
  };
}

/**
 * Validates if a year is valid for a given era
 * @param year - Positive year value
 * @param era - Era designation ('BC' or 'AD')
 * @returns True if the year is valid for the given era
 */
export function isValidEraYear(year: number, era: Era): boolean {
  // Year must be positive in UI
  if (year < 0) {
    return false;
  }

  const internalYear = convertToInternalYear(year, era);

  // Check against game bounds
  if (internalYear < GAME_CONFIG.MIN_YEAR || internalYear > GAME_CONFIG.MAX_YEAR) {
    return false;
  }

  // Additional era-specific validation
  if (era === "BC") {
    // BC years: 0 to 3000 (stored as 0 to -3000)
    return year >= 0 && year <= Math.abs(GAME_CONFIG.MIN_YEAR);
  } else {
    // AD years: 0 to current year
    return year >= 0 && year <= GAME_CONFIG.MAX_YEAR;
  }
}

/**
 * Formats a year with era for display
 * @param year - Positive year value
 * @param era - Era designation
 * @returns Formatted string like "776 BC" or "1969 AD"
 */
export function formatEraYear(year: number, era: Era): string {
  // Ensure year is positive for display
  const displayYear = Math.abs(year);
  return `${displayYear} ${era}`;
}

/**
 * Parses a formatted year string to extract year and era
 * @param yearString - String like "776 BC" or "1969 AD"
 * @returns Parsed year and era, or null if invalid format
 */
export function parseEraYearString(yearString: string): EraYear | null {
  const trimmed = yearString.trim();
  const match = trimmed.match(/^(\d+)\s*(BC|AD|BCE|CE)$/i);

  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const eraText = match[2].toUpperCase();

  // Normalize BCE/CE to BC/AD for consistency
  const era: Era = eraText === "BC" || eraText === "BCE" ? "BC" : "AD";

  return { year, era };
}

/**
 * Gets the valid year range for a given era
 * @param era - Era designation
 * @returns Object with min and max valid years for the era
 */
export function getEraYearRange(era: Era): { min: number; max: number } {
  if (era === "BC") {
    return {
      min: 1,
      max: Math.abs(GAME_CONFIG.MIN_YEAR), // 3000
    };
  } else {
    return {
      min: 0, // Year 0 treated as AD for consistency
      max: GAME_CONFIG.MAX_YEAR,
    };
  }
}

/**
 * Increments or decrements a year within era bounds
 * @param year - Current year value
 * @param era - Current era
 * @param delta - Amount to change (positive or negative)
 * @returns New year value, clamped to valid range
 */
export function adjustYearWithinEra(year: number, era: Era, delta: number): number {
  const newYear = year + delta;
  const range = getEraYearRange(era);

  // Clamp to valid range
  if (newYear < range.min) {
    return range.min;
  }
  if (newYear > range.max) {
    return range.max;
  }

  return newYear;
}

/**
 * Determines if a year could be ambiguous between BC and AD
 * @param year - Year value to check
 * @returns True if the year exists in both BC and AD ranges
 */
export function isAmbiguousYear(year: number): boolean {
  // Years 1-1000 could reasonably be either BC or AD in historical context
  return year >= 1 && year <= 1000;
}
