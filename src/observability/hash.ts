/**
 * Hash utility for user identifiers
 *
 * Hashes sensitive identifiers (userId, clerkId) before sending to observability platforms
 * to prevent PII leakage while maintaining uniqueness for debugging.
 */

/**
 * Simple hash function (FNV-1a) for creating short, deterministic hashes
 * @param input - String to hash
 * @returns 8-character hex hash
 */
export function hashIdentifier(input: string): string {
  if (!input) return "anonymous";

  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to unsigned 32-bit and format as 8-char hex
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Redacts ordering array if too large
 * @param ordering - Array of year IDs
 * @returns Redacted array or original if small enough
 */
export function redactLargeArray<T>(arr: T[], maxSize = 10): T[] | string {
  if (arr.length <= maxSize) return arr;
  return `[redacted: ${arr.length} items]` as unknown as T[];
}
