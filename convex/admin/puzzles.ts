/**
 * Admin Puzzles API
 *
 * Deep module for puzzle management:
 * - Unified listing for Classic and Order puzzles
 * - Detailed puzzle view with events and stats
 *
 * Principle: Single interface hides mode-specific table complexity.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

const modeValidator = v.union(v.literal("classic"), v.literal("order"));

/**
 * List puzzles for a given mode.
 * Returns puzzles ordered by puzzleNumber descending (newest first).
 */
export const listPuzzles = query({
  args: {
    mode: modeValidator,
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const cursorIndex = args.cursor ? parseInt(args.cursor, 10) : 0;

    if (args.mode === "classic") {
      // Query Classic puzzles
      const puzzles = await ctx.db.query("puzzles").withIndex("by_number").order("desc").collect();

      const totalCount = puzzles.length;
      const paginatedPuzzles = puzzles.slice(cursorIndex, cursorIndex + limit);
      const nextCursor = cursorIndex + limit < totalCount ? String(cursorIndex + limit) : null;

      // Map to unified format
      const mappedPuzzles = paginatedPuzzles.map((p) => ({
        _id: p._id,
        puzzleNumber: p.puzzleNumber,
        date: p.date,
        targetYear: p.targetYear,
        eventCount: p.events.length,
        playCount: p.playCount,
        avgScore: p.avgGuesses, // avgGuesses for Classic
        hasHistoricalContext: !!p.historicalContext,
        status: getPuzzleStatus(p.date),
      }));

      return { puzzles: mappedPuzzles, nextCursor, totalCount };
    } else {
      // Query Order puzzles
      const puzzles = await ctx.db
        .query("orderPuzzles")
        .withIndex("by_number")
        .order("desc")
        .collect();

      const totalCount = puzzles.length;
      const paginatedPuzzles = puzzles.slice(cursorIndex, cursorIndex + limit);
      const nextCursor = cursorIndex + limit < totalCount ? String(cursorIndex + limit) : null;

      // Calculate play counts from orderPlays table
      const plays = await ctx.db.query("orderPlays").collect();

      // Count plays per puzzle
      const playCountMap = new Map<string, number>();
      for (const play of plays) {
        const pid = play.puzzleId.toString();
        playCountMap.set(pid, (playCountMap.get(pid) || 0) + 1);
      }

      // Map to unified format
      const mappedPuzzles = paginatedPuzzles.map((p) => {
        // Calculate event span (min year to max year)
        const years = p.events.map((e) => e.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const eventSpan = `${formatYear(minYear)} – ${formatYear(maxYear)}`;

        return {
          _id: p._id,
          puzzleNumber: p.puzzleNumber,
          date: p.date,
          eventSpan,
          eventCount: p.events.length,
          playCount: playCountMap.get(p._id.toString()) || 0,
          avgScore: null, // Order mode doesn't track avgScore in same way
          status: getPuzzleStatus(p.date),
        };
      });

      return { puzzles: mappedPuzzles, nextCursor, totalCount };
    }
  },
});

/**
 * Get detailed puzzle information.
 * Returns full puzzle data with events and stats.
 */
export const getPuzzleDetail = query({
  args: {
    mode: modeValidator,
    puzzleNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.mode === "classic") {
      const puzzle = await ctx.db
        .query("puzzles")
        .withIndex("by_number", (q) => q.eq("puzzleNumber", args.puzzleNumber))
        .first();

      if (!puzzle) {
        return null;
      }

      // Get play statistics
      const plays = await ctx.db
        .query("plays")
        .withIndex("by_puzzle", (q) => q.eq("puzzleId", puzzle._id))
        .collect();

      const completedPlays = plays.filter((p) => p.completedAt !== undefined);
      const completionRate = plays.length > 0 ? (completedPlays.length / plays.length) * 100 : 0;

      return {
        _id: puzzle._id,
        mode: "classic" as const,
        puzzleNumber: puzzle.puzzleNumber,
        date: puzzle.date,
        targetYear: puzzle.targetYear,
        events: puzzle.events,
        playCount: puzzle.playCount,
        avgGuesses: puzzle.avgGuesses,
        completionRate: Math.round(completionRate),
        historicalContext: puzzle.historicalContext,
        historicalContextGeneratedAt: puzzle.historicalContextGeneratedAt,
        status: getPuzzleStatus(puzzle.date),
      };
    } else {
      const puzzle = await ctx.db
        .query("orderPuzzles")
        .withIndex("by_number", (q) => q.eq("puzzleNumber", args.puzzleNumber))
        .first();

      if (!puzzle) {
        return null;
      }

      // Get play statistics from orderPlays
      const plays = await ctx.db.query("orderPlays").withIndex("by_user_puzzle").collect();

      const puzzlePlays = plays.filter((p) => p.puzzleId.toString() === puzzle._id.toString());
      const completedPlays = puzzlePlays.filter((p) => p.completedAt !== undefined);
      const completionRate =
        puzzlePlays.length > 0 ? (completedPlays.length / puzzlePlays.length) * 100 : 0;

      // Calculate event span
      const years = puzzle.events.map((e) => e.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);

      return {
        _id: puzzle._id,
        mode: "order" as const,
        puzzleNumber: puzzle.puzzleNumber,
        date: puzzle.date,
        events: puzzle.events,
        eventSpan: { min: minYear, max: maxYear },
        playCount: puzzlePlays.length,
        completionRate: Math.round(completionRate),
        seed: puzzle.seed,
        status: getPuzzleStatus(puzzle.date),
      };
    }
  },
});

/**
 * Get today's puzzles for both modes.
 * Used by OverviewTab "Today's Puzzles" card.
 */
export const getTodaysPuzzles = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const today = new Date().toISOString().split("T")[0];

    // Get today's Classic puzzle
    const classicPuzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    // Get today's Order puzzle
    const orderPuzzle = await ctx.db
      .query("orderPuzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    // Get play count for Order puzzle
    let orderPlayCount = 0;
    if (orderPuzzle) {
      const plays = await ctx.db.query("orderPlays").withIndex("by_user_puzzle").collect();
      orderPlayCount = plays.filter(
        (p) => p.puzzleId.toString() === orderPuzzle._id.toString(),
      ).length;
    }

    return {
      date: today,
      classic: classicPuzzle
        ? {
            _id: classicPuzzle._id,
            puzzleNumber: classicPuzzle.puzzleNumber,
            targetYear: classicPuzzle.targetYear,
            eventCount: classicPuzzle.events.length,
            playCount: classicPuzzle.playCount,
            hasHistoricalContext: !!classicPuzzle.historicalContext,
          }
        : null,
      order: orderPuzzle
        ? {
            _id: orderPuzzle._id,
            puzzleNumber: orderPuzzle.puzzleNumber,
            eventSpan: getEventSpan(orderPuzzle.events),
            eventCount: orderPuzzle.events.length,
            playCount: orderPlayCount,
          }
        : null,
    };
  },
});

// Helper: Determine puzzle status based on date
function getPuzzleStatus(puzzleDate: string): "active" | "completed" | "future" {
  const today = new Date().toISOString().split("T")[0];
  if (puzzleDate === today) return "active";
  if (puzzleDate < today) return "completed";
  return "future";
}

// Helper: Format year with BC/AD
function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`;
  return `${year} AD`;
}

// Helper: Get event span string
function getEventSpan(events: Array<{ year: number }>): string {
  const years = events.map((e) => e.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  return `${formatYear(minYear)} – ${formatYear(maxYear)}`;
}
