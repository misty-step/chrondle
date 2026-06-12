import { v } from "convex/values";
import { query } from "../_generated/server";
import { createPrng } from "../lib/prng";
import { selectDuelRounds, type DuelEventCandidate } from "./selection";

/**
 * Duel round retrieval.
 *
 * Duel is an endless arcade mode, not a daily puzzle: the client owns the run
 * (seed, streak, best score) and asks the server for batches of rounds drawn
 * from the shared events pool.
 *
 * Cost control: instead of collecting the whole events table (~12k docs) per
 * call, we sample a bounded set of seeded year windows via the by_year index
 * (≤ WINDOW_COUNT × WINDOW_TAKE docs + 2 boundary reads). Selection then runs
 * over that candidate set; its progressive gap relaxation absorbs sparse
 * windows. Deterministic per (seed, count, startRound, excludeIds).
 *
 * Years are included in the response by design — the client reveals them as
 * feedback after each tap, exactly like Classic ships its target year for
 * client-side containment checks. Duel has no daily answer to protect.
 */

const MAX_ROUNDS_PER_REQUEST = 30;
const MAX_START_ROUND = 1000;
const MAX_EXCLUDE_IDS = 240;

/** Year-window sampling bounds: ≤ 14 × 40 = 560 candidate docs per call. */
const WINDOW_COUNT = 14;
const WINDOW_YEARS = 200;
const WINDOW_TAKE = 40;

export const getDuelRounds = query({
  args: {
    seed: v.number(),
    count: v.number(),
    startRound: v.optional(v.number()),
    excludeIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { seed, count, startRound = 0, excludeIds = [] }) => {
    const boundedCount = Math.min(
      Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)),
      MAX_ROUNDS_PER_REQUEST,
    );
    const boundedStart = Math.min(
      Math.max(0, Math.floor(Number.isFinite(startRound) ? startRound : 0)),
      MAX_START_ROUND,
    );
    // Most recent exclusions matter most; cap to bound query work.
    const boundedExcludes = excludeIds.slice(-MAX_EXCLUDE_IDS);

    // Pool year range from the index boundaries (2 doc reads).
    const earliest = await ctx.db.query("events").withIndex("by_year").order("asc").first();
    const latest = await ctx.db.query("events").withIndex("by_year").order("desc").first();

    if (!earliest || !latest) {
      return { rounds: [], poolSize: 0 };
    }

    // Seeded year-window sampling. A separate PRNG instance keeps the
    // selection PRNG's sequence unchanged.
    const prng = createPrng(seed);
    const span = Math.max(1, latest.year - earliest.year + 1);
    const candidates = new Map<string, DuelEventCandidate>();

    for (let i = 0; i < WINDOW_COUNT; i++) {
      const windowStart = earliest.year + Math.floor(prng() * span);
      const docs = await ctx.db
        .query("events")
        .withIndex("by_year", (q) =>
          q.gte("year", windowStart).lte("year", windowStart + WINDOW_YEARS),
        )
        .take(WINDOW_TAKE);

      for (const doc of docs) {
        candidates.set(doc._id, { _id: doc._id, year: doc.year, event: doc.event });
      }
    }

    const rounds = selectDuelRounds([...candidates.values()], seed, {
      count: boundedCount,
      startRound: boundedStart,
      excludeIds: boundedExcludes,
    });

    return { rounds, poolSize: candidates.size };
  },
});
