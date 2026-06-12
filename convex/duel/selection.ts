import { Doc } from "../_generated/dataModel";
import { createPrng } from "../lib/prng";
import { tierForRound } from "../../src/lib/duel/difficulty";

/**
 * Event candidates pulled from the shared events pool.
 * Only the fields required for Duel round generation are retained.
 */
export type DuelEventCandidate = Pick<Doc<"events">, "_id" | "year" | "event">;

export interface DuelRoundEvent {
  id: string;
  year: number;
  text: string;
}

export interface DuelRound {
  /** 0-based global round index (continues across batches) */
  roundIndex: number;
  /** Event shown in the first slot (top card on mobile) */
  first: DuelRoundEvent;
  /** Event shown in the second slot */
  second: DuelRoundEvent;
  /** Absolute year gap between the two events */
  gap: number;
  /** Difficulty tier label for this round */
  tierLabel: string;
}

export interface DuelSelectionOptions {
  /** Number of rounds to generate */
  count: number;
  /** Global round index of the first generated round (drives difficulty) */
  startRound?: number;
  /** Event ids already shown in this run; never reused */
  excludeIds?: ReadonlyArray<string>;
}

const PICK_ATTEMPTS_PER_WINDOW = 40;

/**
 * Selects a deterministic sequence of "which happened first?" rounds.
 *
 * - Each round pairs two events whose year gap falls inside the difficulty
 *   tier window for that round (gaps narrow as the run progresses).
 * - Events are never repeated within a batch or against `excludeIds`.
 * - Display order (first/second slot) is a seeded coin flip, so the earlier
 *   event is not positionally predictable.
 * - When the pool cannot satisfy a tier window (sparse eras, deep runs), the
 *   window relaxes progressively rather than ending the run — gameplay
 *   continuity beats strict difficulty.
 *
 * Deterministic: identical inputs always produce identical rounds. Returns
 * fewer than `count` rounds only when the pool is effectively exhausted.
 */
export function selectDuelRounds(
  events: ReadonlyArray<DuelEventCandidate>,
  seed: number,
  options: DuelSelectionOptions,
): DuelRound[] {
  const { count, startRound = 0, excludeIds = [] } = options;

  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  const excluded = new Set(excludeIds);
  // Sort for determinism regardless of input order.
  const pool = events
    .filter((event) => !excluded.has(event._id) && !textLeaksOwnYear(event))
    .sort((a, b) => a.year - b.year || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));

  if (pool.length < 2) {
    return [];
  }

  const prng = createPrng(seed);
  const used = new Set<string>();
  const rounds: DuelRound[] = [];

  for (let i = 0; i < count; i++) {
    const roundIndex = startRound + i;
    const tier = tierForRound(roundIndex);
    const available = pool.filter((event) => !used.has(event._id));

    if (available.length < 2) {
      break;
    }

    // Progressive relaxation: strict tier window first, then widen outward,
    // finally accept any pair with distinct years.
    const windows: Array<{ minGap: number; maxGap: number }> = [
      { minGap: tier.minGap, maxGap: tier.maxGap },
      { minGap: 1, maxGap: tier.maxGap * 4 },
      { minGap: 1, maxGap: Number.POSITIVE_INFINITY },
    ];

    const pair = pickPair(available, prng, windows);
    if (!pair) {
      break;
    }

    const [a, b] = pair;
    used.add(a._id);
    used.add(b._id);

    const flip = prng() < 0.5;
    const first = flip ? a : b;
    const second = flip ? b : a;

    rounds.push({
      roundIndex,
      first: toRoundEvent(first),
      second: toRoundEvent(second),
      gap: Math.abs(a.year - b.year),
      tierLabel: tier.label,
    });
  }

  return rounds;
}

function toRoundEvent(candidate: DuelEventCandidate): DuelRoundEvent {
  return { id: candidate._id, year: candidate.year, text: candidate.event };
}

/**
 * Duel shows the year beside the text on every reveal, so an event whose text
 * contains its own year would answer the round for the player. The events
 * pipeline screens for leaks, but this is the mode where a slip is fatal —
 * filter defensively. Only checked for 3+ digit years; one- and two-digit
 * matches ("Apollo 11") are overwhelmingly incidental.
 */
function textLeaksOwnYear(candidate: DuelEventCandidate): boolean {
  const absYear = Math.abs(candidate.year);
  return absYear >= 100 && candidate.event.includes(String(absYear));
}

function pickPair(
  available: ReadonlyArray<DuelEventCandidate>,
  prng: () => number,
  windows: ReadonlyArray<{ minGap: number; maxGap: number }>,
): [DuelEventCandidate, DuelEventCandidate] | null {
  for (const window of windows) {
    for (let attempt = 0; attempt < PICK_ATTEMPTS_PER_WINDOW; attempt++) {
      const anchor = available[Math.floor(prng() * available.length)];
      const partners = available.filter((event) => {
        if (event._id === anchor._id) return false;
        const gap = Math.abs(event.year - anchor.year);
        return gap >= window.minGap && gap <= window.maxGap;
      });

      if (partners.length > 0) {
        const partner = partners[Math.floor(prng() * partners.length)];
        return [anchor, partner];
      }
    }
  }

  return null;
}
