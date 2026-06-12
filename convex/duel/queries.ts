import { v } from "convex/values";
import { query } from "../_generated/server";
import { selectDuelRounds } from "./selection";

/**
 * Duel round retrieval.
 *
 * Duel is an endless arcade mode, not a daily puzzle: the client owns the run
 * (seed, streak, best score) and asks the server for batches of rounds drawn
 * from the shared events pool. The query is pure and deterministic per
 * (seed, count, startRound, excludeIds), so Convex result caching applies.
 *
 * Years are included in the response by design — the client reveals them as
 * feedback after each tap, exactly like Classic ships its target year for
 * client-side containment checks. Duel has no daily answer to protect.
 */

const MAX_ROUNDS_PER_REQUEST = 30;
const MAX_START_ROUND = 1000;
const MAX_EXCLUDE_IDS = 240;

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

    const events = await ctx.db.query("events").collect();
    const candidates = events.map((event) => ({
      _id: event._id,
      year: event.year,
      event: event.event,
    }));

    const rounds = selectDuelRounds(candidates, seed, {
      count: boundedCount,
      startRound: boundedStart,
      excludeIds: boundedExcludes,
    });

    return { rounds, poolSize: candidates.length };
  },
});
