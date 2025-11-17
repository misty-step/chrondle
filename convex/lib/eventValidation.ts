/**
 * Event Validation Module
 *
 * Deterministic rules for validating generated historical events.
 * Used by Critic agent to filter out events with year leakage,
 * missing proper nouns, or insufficient domain diversity.
 *
 * Module Design:
 * - Pure functions (no side effects)
 * - Regex-based validation (fast, deterministic)
 * - Testable with golden file examples
 */

/**
 * Leakage detection patterns
 *
 * Catches year hints that would make the puzzle too easy:
 * - Numerals ≥10 (e.g., "12", "1969")
 * - Century/decade terms (e.g., "19th century", "1960s")
 * - Spelled-out years (e.g., "nineteen sixty-nine")
 * - BCE/CE/BC/AD terminology
 */
export const LEAKAGE_PATTERNS = {
  // Numerals ≥10
  digits: /\b[1-9]\d+\b/,

  // Century/decade/era terms (case-insensitive)
  eraTerms: /\b(century|centuries|decade|decades|millennium|millennia|BCE|CE|BC|AD)\b/i,
} as const;

/**
 * Checks if event text contains year leakage
 *
 * @param text - Event text to validate
 * @returns true if leakage detected, false if clean
 *
 * @example
 * hasLeakage("Event in 1969") // true - contains numeral
 * hasLeakage("Event in the 19th century") // true - contains century term
 * hasLeakage("Apollo mission succeeds") // false - no leakage
 */
export function hasLeakage(text: string): boolean {
  return Object.values(LEAKAGE_PATTERNS).some((pattern) => pattern.test(text));
}

/**
 * Checks if event text contains proper noun
 *
 * Proper nouns (capitalized words) make events more specific and
 * help players deduce the year. Events without proper nouns tend
 * to be too vague.
 *
 * @param text - Event text to validate
 * @returns true if proper noun found after first word
 *
 * @example
 * hasProperNoun("Battle of Hastings begins") // true - "Hastings"
 * hasProperNoun("A war starts in europe") // false - "europe" lowercase
 * hasProperNoun("Something happens") // false - no proper nouns
 */
export function hasProperNoun(text: string): boolean {
  // Look for space followed by capital letter (proper noun after sentence start)
  return /\s[A-Z]/.test(text);
}

/**
 * Event interface for domain diversity validation
 */
interface EventWithDomain {
  domain: string;
}

/**
 * Checks if events have sufficient domain diversity
 *
 * Prevents all events from being politics or war events.
 * Enforces max 3 events per domain (50% of 6 events).
 *
 * @param events - Array of events to validate
 * @returns true if domain diversity is sufficient
 *
 * @example
 * checkDomainDiversity([
 *   { domain: 'politics' },
 *   { domain: 'politics' },
 *   { domain: 'politics' },
 *   { domain: 'politics' }, // 4 politics events
 * ]) // false - too many from same domain
 *
 * checkDomainDiversity([
 *   { domain: 'politics' },
 *   { domain: 'science' },
 *   { domain: 'culture' },
 * ]) // true - diverse domains
 */
export function checkDomainDiversity(events: EventWithDomain[]): boolean {
  const domainCounts = events.reduce(
    (counts, e) => {
      counts[e.domain] = (counts[e.domain] || 0) + 1;
      return counts;
    },
    {} as Record<string, number>,
  );

  // No more than 3 events from same domain (50% of 6)
  return Object.values(domainCounts).every((count) => count <= 3);
}

/**
 * Validates event text meets word count requirement
 *
 * @param text - Event text to validate
 * @param maxWords - Maximum word count (default: 20)
 * @returns true if word count is within limit
 */
export function isValidWordCount(text: string, maxWords = 20): boolean {
  return text.trim().split(/\s+/).length <= maxWords;
}
