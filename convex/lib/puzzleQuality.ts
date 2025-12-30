/**
 * Puzzle Quality - Pure Functions
 *
 * Deterministic quality checks for puzzles that don't require LLM calls.
 * Can be imported by Convex mutations/queries (no "use node" needed).
 */

/**
 * Quick check for obvious redundancy without LLM call.
 * Use as a fast pre-filter before the full critique.
 *
 * Algorithm: Check for >60% word overlap between any two hints.
 */
export function hasObviousRedundancy(hints: string[]): boolean {
  const normalized = hints.map((h) => h.toLowerCase().replace(/[^a-z0-9\s]/g, ""));

  // Check for identical or near-identical hints
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const words1 = new Set(normalized[i].split(/\s+/).filter((w) => w.length > 3));
      const words2 = new Set(normalized[j].split(/\s+/).filter((w) => w.length > 3));

      // Count overlap
      const overlap = [...words1].filter((w) => words2.has(w)).length;
      const minSize = Math.min(words1.size, words2.size);

      // If >60% word overlap, likely redundant
      if (minSize > 0 && overlap / minSize > 0.6) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if hints have topic diversity.
 * Returns true if at least 3 different topics are covered.
 */
export function hasTopicDiversity(
  events: Array<{ text: string; category: string }>,
  minCategories = 3,
): boolean {
  const uniqueCategories = new Set(events.map((e) => e.category));
  return uniqueCategories.size >= minCategories;
}

/**
 * Select best hints from a larger pool to form a quality puzzle.
 * Tries to maximize diversity and avoid redundancy.
 */
export function selectDiverseHints(
  events: Array<{ text: string; category: string; difficulty: number }>,
  count = 6,
): string[] {
  if (events.length < count) {
    throw new Error(`Need at least ${count} events, got ${events.length}`);
  }

  // Sort by difficulty to ensure we get a range
  const sorted = [...events].sort((a, b) => a.difficulty - b.difficulty);

  // Take from different difficulty tiers
  const selected: typeof events = [];
  const usedCategories = new Set<string>();

  // First pass: one from each category if possible
  for (const event of sorted) {
    if (selected.length >= count) break;
    if (!usedCategories.has(event.category)) {
      selected.push(event);
      usedCategories.add(event.category);
    }
  }

  // Second pass: fill remaining slots with best remaining events
  for (const event of sorted) {
    if (selected.length >= count) break;
    if (!selected.includes(event)) {
      selected.push(event);
    }
  }

  return selected.slice(0, count).map((e) => e.text);
}
