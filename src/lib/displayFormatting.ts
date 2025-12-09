/**
 * Display Formatting Utilities for Chrondle
 * Provides consistent year and era formatting across the entire application
 */

import type { Era } from "./eraUtils";

/**
 * Formatting style options for year display
 */
export type FormatStyle = "standard" | "abbreviated" | "bce-ce" | "compact";

/**
 * Configuration for year display formatting
 */
export interface FormatOptions {
  style?: FormatStyle;
  includeEra?: boolean;
  lowercase?: boolean;
}

/**
 * Formats a year with era designation based on internal representation
 * @param year - Internal year representation (negative = BC, positive = AD)
 * @param options - Formatting options
 * @returns Formatted year string
 */
export function formatYearWithOptions(year: number, options: FormatOptions = {}): string {
  const { style = "standard", includeEra = true, lowercase = false } = options;

  const absYear = Math.abs(year);
  const isBC = year < 0;

  // Determine era designation based on style
  let era = "";
  if (includeEra) {
    switch (style) {
      case "abbreviated":
        era = isBC ? "B" : "A";
        break;
      case "bce-ce":
        era = isBC ? "BCE" : "CE";
        break;
      case "compact":
        era = isBC ? "bc" : "ad";
        break;
      default: // standard
        era = isBC ? "BC" : "AD";
    }
  }

  // Apply case transformation
  if (lowercase && style !== "compact") {
    era = era.toLowerCase();
  }

  // Format based on style
  if (style === "compact") {
    return includeEra ? `${absYear}${era}` : `${absYear}`;
  }

  return includeEra ? `${absYear} ${era}` : `${absYear}`;
}

/**
 * Formats a year with explicit era designation
 * @param year - Positive year value
 * @param era - Era designation (BC or AD)
 * @param options - Formatting options
 * @returns Formatted year string
 */
export function formatYearWithEra(year: number, era: Era, options: FormatOptions = {}): string {
  const internalYear = era === "BC" ? -Math.abs(year) : Math.abs(year);
  return formatYearWithOptions(internalYear, options);
}

/**
 * Standard year formatting (maintains backward compatibility)
 * @param year - Internal year representation
 * @returns Formatted year string in standard format
 */
export function formatYearStandard(year: number): string {
  return formatYearWithOptions(year, { style: "standard" });
}

/**
 * Formats year range with consistent styling
 * @param startYear - Start year (internal representation)
 * @param endYear - End year (internal representation)
 * @param options - Formatting options
 * @returns Formatted year range string
 */
export function formatYearRange(
  startYear: number,
  endYear: number,
  options: FormatOptions = {},
): string {
  const start = formatYearWithOptions(startYear, options);
  const end = formatYearWithOptions(endYear, options);

  // Optimize for same era ranges
  if ((startYear < 0 && endYear < 0) || (startYear >= 0 && endYear >= 0)) {
    const startNum = Math.abs(startYear);
    const endNum = Math.abs(endYear);

    // Get the era part from the formatted string
    const formattedWithEra = formatYearWithOptions(startYear, {
      ...options,
      includeEra: true,
    });
    const eraIndex = formattedWithEra.indexOf(startNum.toString()) + startNum.toString().length;
    const era = formattedWithEra.substring(eraIndex);

    if (era) {
      if (options.style === "compact") {
        // For compact style, no space between numbers and era
        return `${startNum}–${endNum}${era}`;
      } else {
        // For other styles, space before era
        return `${startNum}–${endNum}${era}`;
      }
    }
  }

  return `${start} – ${end}`;
}

/**
 * Formats relative year distance for proximity feedback
 * @param distance - Number of years difference
 * @returns Human-readable distance string
 */
export function formatYearDistance(distance: number): string {
  const absDistance = Math.abs(distance);

  if (absDistance === 0) {
    return "exact";
  } else if (absDistance === 1) {
    return "1 year";
  } else if (absDistance < 10) {
    return `${absDistance} years`;
  } else if (absDistance < 25) {
    return `about ${Math.round(absDistance / 5) * 5} years`;
  } else if (absDistance < 100) {
    return `about ${Math.round(absDistance / 10) * 10} years`;
  } else if (absDistance < 1000) {
    return `about ${Math.round(absDistance / 50) * 50} years`;
  } else {
    return `about ${Math.round(absDistance / 100) * 100} years`;
  }
}

/**
 * Formats century designation from year
 * @param year - Internal year representation
 * @returns Century string (e.g., "8th century BC", "20th century AD")
 */
export function formatCentury(year: number): string {
  const absYear = Math.abs(year);
  const century = Math.ceil(absYear / 100);
  const isBC = year < 0;

  // Handle ordinal suffix
  const suffix = getCenturyOrdinalSuffix(century);
  const era = isBC ? "BC" : "AD";

  return `${century}${suffix} century ${era}`;
}

/**
 * Gets ordinal suffix for century number
 * @param century - Century number
 * @returns Ordinal suffix
 */
function getCenturyOrdinalSuffix(century: number): string {
  const lastDigit = century % 10;
  const lastTwoDigits = century % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return "th";
  }

  switch (lastDigit) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Formats era for display with consistent styling
 * @param era - Era designation
 * @param style - Format style
 * @returns Formatted era string
 */
export function formatEra(era: Era, style: FormatStyle = "standard"): string {
  switch (style) {
    case "abbreviated":
      return era === "BC" ? "B" : "A";
    case "bce-ce":
      return era === "BC" ? "BCE" : "CE";
    case "compact":
      return era.toLowerCase();
    default:
      return era;
  }
}

/**
 * Checks if two years are in the same era
 * @param year1 - First year (internal representation)
 * @param year2 - Second year (internal representation)
 * @returns True if both years are in the same era
 */
export function isSameEra(year1: number, year2: number): boolean {
  return (year1 < 0 && year2 < 0) || (year1 >= 0 && year2 >= 0);
}

/**
 * Gets human-readable era description
 * @param era - Era designation
 * @returns Human-readable era description
 */
export function getEraDescription(era: Era): string {
  return era === "BC" ? "Before Christ" : "Anno Domini";
}

/**
 * Formats a date string into a readable format
 * @param dateString - Date string (e.g., "2025-11-10" or ISO format)
 * @returns Formatted date string (e.g., "Nov 10, 2025")
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Pluralizes a word based on count
 * @param count - Number determining pluralization
 * @param singular - Singular form of the word
 * @param plural - Optional custom plural form (defaults to singular + 's')
 * @returns Properly pluralized string with count
 * @example
 * pluralize(1, 'year') => '1 year'
 * pluralize(2, 'year') => '2 years'
 * pluralize(1, 'clue') => '1 clue'
 * pluralize(3, 'clue') => '3 clues'
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const pluralForm = plural || `${singular}s`;
  return count === 1 ? `${count} ${singular}` : `${count} ${pluralForm}`;
}

/**
 * Pluralizes a word without the count prefix
 * @param count - Number determining pluralization
 * @param singular - Singular form of the word
 * @param plural - Optional custom plural form (defaults to singular + 's')
 * @returns Just the pluralized word (no count)
 * @example
 * pluralizeWord(1, 'year') => 'year'
 * pluralizeWord(2, 'year') => 'years'
 */
export function pluralizeWord(count: number, singular: string, plural?: string): string {
  const pluralForm = plural || `${singular}s`;
  return count === 1 ? singular : pluralForm;
}

/**
 * Export a compatibility wrapper for existing formatYear function
 * This ensures backward compatibility while transitioning to new utilities
 */
export { formatYearStandard as formatYear };

// ============================================================================
// TIME/COUNTDOWN FORMATTING
// ============================================================================

/**
 * Calculates milliseconds until next midnight local time
 * Used for countdown timers to next daily puzzle
 *
 * @returns Milliseconds until midnight (00:00:00)
 */
export function getTimeUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

/**
 * Formats milliseconds into HH:MM:SS countdown format
 * Always displays with 2-digit padding for consistent width
 *
 * @param milliseconds - Time in milliseconds to format
 * @returns Formatted string in "HH:MM:SS" format
 */
export function formatCountdown(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
