import type { OrderEvent, OrderHint } from "@/types/orderGameState";

export type AnchorHintOptions = {
  seed?: number;
  /**
   * Prevent revealing events that already received an anchor hint.
   */
  excludeEventIds?: string[];
};

export type RelativeHintOptions = {
  seed?: number;
  /**
   * Prevent repeating earlier-later pairs that already surfaced.
   */
  excludePairs?: Array<{ earlierEventId: string; laterEventId: string }>;
};

/**
 * Reveals which event belongs in a specific position.
 * When multiple slots are incorrect, selection is randomized with a deterministic seed.
 */
export function generateAnchorHint(
  currentOrder: string[],
  correctOrder: string[],
  options: AnchorHintOptions = {},
): OrderHint {
  const excluded = new Set(options.excludeEventIds ?? []);
  const candidates = collectAnchorCandidates(currentOrder, correctOrder, excluded);
  const selection = pickDeterministic(candidates, options.seed, "anchor");

  return {
    type: "anchor",
    eventId: selection.eventId,
    position: selection.position,
  };
}

/**
 * Provides a relative ordering hint (event A occurs before event B).
 * Picks among all misordered pairs; falls back to reinforcing the earliest chronological pair.
 */
export function generateRelativeHint(
  currentOrder: string[],
  events: OrderEvent[],
  options: RelativeHintOptions = {},
): OrderHint {
  const chronological = [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const indexById = new Map(chronological.map((event, idx) => [event.id, idx]));
  const excludedPairs = new Set(
    (options.excludePairs ?? []).map((pair) =>
      serializePair(pair.earlierEventId, pair.laterEventId),
    ),
  );

  const misorderedPairs = collectMisorderedPairs(
    currentOrder,
    indexById,
    chronological,
    excludedPairs,
  );
  const fallbackPairs = misorderedPairs.length
    ? misorderedPairs
    : collectAdjacentPairs(chronological, excludedPairs);

  const selection = pickDeterministic(fallbackPairs, options.seed, "relative");

  return {
    type: "relative",
    earlierEventId: selection.earlierEventId,
    laterEventId: selection.laterEventId,
  };
}

/**
 * Returns a bracket hint describing the event's year range.
 */
export function generateBracketHint(event: OrderEvent, span: number = 25): OrderHint {
  const normalizedSpan = Math.max(0, span);
  const lower = event.year - normalizedSpan;
  const upper = event.year + normalizedSpan;

  return {
    type: "bracket",
    eventId: event.id,
    yearRange: [Math.min(lower, upper), Math.max(lower, upper)],
  };
}

type AnchorCandidate = { eventId: string; position: number };
type RelativeCandidate = { earlierEventId: string; laterEventId: string };

function collectAnchorCandidates(
  currentOrder: string[],
  correctOrder: string[],
  excluded: Set<string>,
): AnchorCandidate[] {
  if (!correctOrder.length) {
    return [{ eventId: "", position: 0 }];
  }

  const mismatched: AnchorCandidate[] = [];
  const fallback: AnchorCandidate[] = [];

  for (let i = 0; i < correctOrder.length; i++) {
    const eventId = correctOrder[i];
    if (!eventId || excluded.has(eventId)) {
      continue;
    }

    const candidate = { eventId, position: i };
    fallback.push(candidate);

    if (currentOrder[i] !== eventId) {
      mismatched.push(candidate);
    }
  }

  if (mismatched.length) {
    return mismatched;
  }

  return fallback.length ? fallback : [{ eventId: correctOrder[0] ?? "", position: 0 }];
}

function collectMisorderedPairs(
  currentOrder: string[],
  indexById: Map<string, number>,
  chronological: OrderEvent[],
  excludedPairs: Set<string>,
): RelativeCandidate[] {
  const candidates: RelativeCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < currentOrder.length; i++) {
    for (let j = i + 1; j < currentOrder.length; j++) {
      const first = currentOrder[i];
      const second = currentOrder[j];

      const firstIndex = indexById.get(first);
      const secondIndex = indexById.get(second);

      if (firstIndex === undefined || secondIndex === undefined) {
        continue;
      }

      if (firstIndex > secondIndex) {
        const earlierEventId = chronological[Math.min(firstIndex, secondIndex)].id;
        const laterEventId = chronological[Math.max(firstIndex, secondIndex)].id;
        const key = serializePair(earlierEventId, laterEventId);

        if (excludedPairs.has(key) || seen.has(key)) {
          continue;
        }

        seen.add(key);
        candidates.push({ earlierEventId, laterEventId });
      }
    }
  }

  return candidates;
}

function collectAdjacentPairs(
  events: OrderEvent[],
  excludedPairs: Set<string>,
): RelativeCandidate[] {
  if (!events.length) {
    return [{ earlierEventId: "", laterEventId: "" }];
  }

  const pairs: RelativeCandidate[] = [];

  for (let i = 0; i < events.length - 1; i++) {
    const earlierEventId = events[i].id;
    const laterEventId = events[i + 1].id;
    const key = serializePair(earlierEventId, laterEventId);

    if (excludedPairs.has(key)) {
      continue;
    }

    pairs.push({ earlierEventId, laterEventId });
  }

  if (!pairs.length) {
    if (events.length >= 2) {
      pairs.push({ earlierEventId: events[0].id, laterEventId: events[1].id });
    } else {
      const onlyId = events[0].id;
      pairs.push({ earlierEventId: onlyId, laterEventId: onlyId });
    }
  }

  return pairs;
}

function pickDeterministic<T>(candidates: T[], seed: number | undefined, salt: string): T {
  if (!candidates.length) {
    throw new Error("Cannot select hint from an empty candidate pool.");
  }

  const signatureSeed = hashStrings(
    candidates.map((candidate) => JSON.stringify(candidate)).concat(salt),
  );
  const resolvedSeed = typeof seed === "number" ? mixSeeds(seed, signatureSeed) : signatureSeed;
  const prng = createPrng(resolvedSeed);
  const index = Math.floor(prng() * candidates.length);
  return candidates[index];
}

function serializePair(earlierId: string, laterId: string): string {
  return `${earlierId}->${laterId}`;
}

function hashStrings(values: string[]): number {
  let hash = 0x811c9dc5;
  for (const value of values) {
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= value.length;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mixSeeds(primary: number, salt: number): number {
  const mixed = primary ^ (salt + 0x9e3779b9 + ((primary << 6) >>> 0) + (primary >>> 2));
  return mixed >>> 0;
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
