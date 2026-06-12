/**
 * Seeded PRNG helpers shared by deterministic puzzle generation.
 *
 * The mulberry32-style generator below was extracted verbatim from the Order
 * puzzle generator. Its bit-for-bit behavior is load-bearing: daily puzzles
 * are derived from date-hashed seeds, so changing the algorithm would change
 * already-published puzzles. Do not alter the math.
 */

export function createPrng(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithPrng<T>(items: readonly T[], prng: () => number): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
