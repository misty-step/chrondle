import { Doc } from "../_generated/dataModel";

/**
 * Event selection candidates pulled from the shared events pool.
 * Only the fields required for Order puzzle generation are retained.
 */
export type OrderEventCandidate = Pick<Doc<"events">, "_id" | "year" | "event">;

export type SelectionConfig = {
  count: number;
  minSpan: number;
  maxSpan: number;
  excludeYears: number[];
  maxAttempts?: number;
};

const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * Selects a deterministic set of events that spans a wide chronological range.
 *
 * - Filters out Classic's daily year (and any additional exclusions)
 * - Stratifies the remaining events into equal-width buckets
 * - Picks at most one event from each bucket using a seeded PRNG
 * - Fills any gaps from the remaining pool while preserving determinism
 * - Validates that the final selection satisfies the configured span constraints
 *
 * Hidden complexity: handling sparse eras (empty buckets), BC/AD transitions,
 * retrying with incremented seeds when constraints are not satisfied.
 */
export function selectEventsWithSpread(
  allEvents: OrderEventCandidate[],
  seed: number,
  config: SelectionConfig,
): OrderEventCandidate[] {
  const { count, minSpan, maxSpan, excludeYears, maxAttempts = DEFAULT_MAX_ATTEMPTS } = config;

  if (count <= 0) {
    throw new Error("selectEventsWithSpread requires a positive count.");
  }

  const eligibleEvents = filterEligibleEvents(allEvents, excludeYears);

  if (eligibleEvents.length < count) {
    throw new Error(
      `Only ${eligibleEvents.length} events available after exclusions; need ${count}.`,
    );
  }

  const sortedByYear = [...eligibleEvents].sort((a, b) => a.year - b.year);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = seed + attempt;
    const selection = stratifiedSample(sortedByYear, attemptSeed, count);

    if (selection.length < count) {
      continue;
    }

    const span = computeSpan(selection);
    if (span >= minSpan && span <= maxSpan) {
      return selection;
    }
  }

  throw new Error(
    `Unable to select ${count} events within span ${minSpan}-${maxSpan} after ${maxAttempts} attempts.`,
  );
}

function filterEligibleEvents(
  events: OrderEventCandidate[],
  excludeYears: number[],
): OrderEventCandidate[] {
  if (!excludeYears.length) {
    return [...events];
  }

  const exclusions = new Set(excludeYears);
  return events.filter((event) => !exclusions.has(event.year));
}

function stratifiedSample(
  events: OrderEventCandidate[],
  seed: number,
  count: number,
): OrderEventCandidate[] {
  if (events.length === 0) {
    return [];
  }

  const prng = createPrng(seed);
  const buckets = buildBuckets(events, count);
  const usedIds = new Set<string>();
  const usedYears = new Set<number>();
  const selection: OrderEventCandidate[] = [];

  for (const bucket of buckets) {
    const candidate = pickRandomFromBucket(bucket, prng, usedIds, usedYears);
    if (candidate) {
      selection.push(candidate);
      usedYears.add(candidate.year);
    }
  }

  if (selection.length < count) {
    const leftovers = events.filter(
      (event) => !usedIds.has(event._id) && !usedYears.has(event.year),
    );
    const shuffledLeftovers = shuffleWithPrng(leftovers, prng);

    for (const event of shuffledLeftovers) {
      if (selection.length === count) {
        break;
      }
      usedIds.add(event._id);
      usedYears.add(event.year);
      selection.push(event);
    }
  }

  return selection.slice(0, count);
}

function buildBuckets(events: OrderEventCandidate[], count: number) {
  if (events.length === 0) {
    return [];
  }

  const minYear = events[0].year;
  const maxYear = events[events.length - 1].year;
  const totalSpan = Math.max(1, maxYear - minYear);
  const bucketWidth = Math.max(1, Math.ceil((totalSpan + 1) / count));

  const buckets: OrderEventCandidate[][] = Array.from({ length: count }, () => []);

  for (const event of events) {
    const relativeYear = event.year - minYear;
    const bucketIndex = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor(relativeYear / bucketWidth)),
    );
    buckets[bucketIndex].push(event);
  }

  return buckets;
}

function pickRandomFromBucket(
  bucket: OrderEventCandidate[],
  prng: () => number,
  usedIds: Set<string>,
  usedYears: Set<number>,
): OrderEventCandidate | null {
  if (!bucket.length) {
    return null;
  }

  const available = bucket.filter((event) => !usedIds.has(event._id) && !usedYears.has(event.year));
  if (!available.length) {
    return null;
  }

  const index = Math.floor(prng() * available.length);
  const selection = available[index];
  usedIds.add(selection._id);
  return selection;
}

function shuffleWithPrng<T>(items: T[], prng: () => number): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function computeSpan(events: OrderEventCandidate[]): number {
  if (events.length < 2) {
    return 0;
  }

  const years = events.map((event) => event.year).sort((a, b) => a - b);
  return years[years.length - 1] - years[0];
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
