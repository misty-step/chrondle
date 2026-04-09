/**
 * Admin Puzzles API
 *
 * Deep module for puzzle management:
 * - Unified listing for Classic, Order, and Groups puzzles
 * - Detailed puzzle view with events and stats
 *
 * Principle: Single interface hides mode-specific table complexity.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";

const modeValidator = v.union(v.literal("classic"), v.literal("order"), v.literal("groups"));

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
    } else if (args.mode === "order") {
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
    } else {
      // Query Groups puzzles
      const puzzles = await ctx.db
        .query("groupsPuzzles")
        .withIndex("by_number")
        .order("desc")
        .collect();

      const totalCount = puzzles.length;
      const paginatedPuzzles = puzzles.slice(cursorIndex, cursorIndex + limit);
      const nextCursor = cursorIndex + limit < totalCount ? String(cursorIndex + limit) : null;

      // Map to unified format
      const mappedPuzzles = await Promise.all(
        paginatedPuzzles.map(async (p) => ({
          _id: p._id,
          puzzleNumber: p.puzzleNumber,
          date: p.date,
          yearSpan: getYearSpan(p.groups),
          eventCount: p.board.length,
          groupCount: p.groups.length,
          playCount: await getGroupsPlayCountForPuzzle(ctx, p._id),
          avgScore: null,
          status: getPuzzleStatus(p.date),
        })),
      );

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
    } else if (args.mode === "order") {
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
      const completedPlays = puzzlePlays.filter((p: any) => p.completedAt !== undefined);
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
    } else {
      const puzzle = await ctx.db
        .query("groupsPuzzles")
        .withIndex("by_number", (q) => q.eq("puzzleNumber", args.puzzleNumber))
        .first();

      if (!puzzle) {
        return null;
      }

      // Get play statistics from groupsPlays
      const puzzlePlays = (await (ctx.db.query("groupsPlays") as any)
        .withIndex("by_puzzle", (q: any) => q.eq("puzzleId", puzzle._id))
        .collect()) as any[];
      const completedPlays = puzzlePlays.filter((p) => p.completedAt !== undefined);
      const completionRate =
        puzzlePlays.length > 0 ? (completedPlays.length / puzzlePlays.length) * 100 : 0;

      const years = puzzle.groups.map((group) => group.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);

      return {
        _id: puzzle._id,
        mode: "groups" as const,
        puzzleNumber: puzzle.puzzleNumber,
        date: puzzle.date,
        events: puzzle.board,
        groups: puzzle.groups,
        yearSpan: { min: minYear, max: maxYear },
        eventCount: puzzle.board.length,
        groupCount: puzzle.groups.length,
        playCount: puzzlePlays.length,
        completionRate: Math.round(completionRate),
        seed: puzzle.seed,
        status: getPuzzleStatus(puzzle.date),
      };
    }
  },
});

/**
 * Get today's puzzles for all game modes.
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

    // Get today's Groups puzzle
    const groupsPuzzle = await ctx.db
      .query("groupsPuzzles")
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

    // Get play count for Groups puzzle
    let groupsPlayCount = 0;
    if (groupsPuzzle) {
      groupsPlayCount = await getGroupsPlayCountForPuzzle(ctx, groupsPuzzle._id);
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
      groups: groupsPuzzle
        ? {
            _id: groupsPuzzle._id,
            puzzleNumber: groupsPuzzle.puzzleNumber,
            yearSpan: getYearSpan(groupsPuzzle.groups),
            eventCount: groupsPuzzle.board.length,
            groupCount: groupsPuzzle.groups.length,
            playCount: groupsPlayCount,
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
  if (!events || events.length === 0) return "No events";
  const years = events.map((e) => e.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  return `${formatYear(minYear)} – ${formatYear(maxYear)}`;
}

// Helper: Get year span string from groups
async function getGroupsPlayCountForPuzzle(ctx: any, puzzleId: any) {
  const plays = await ctx.db
    .query("groupsPlays" as any)
    .withIndex("by_puzzle", (q: any) => q.eq("puzzleId", puzzleId))
    .collect();

  return plays.length;
}

function getYearSpan(groups: Array<{ year: number }>): string {
  if (!groups || groups.length === 0) return "No years";
  const years = groups.map((group) => group.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  return `${formatYear(minYear)} – ${formatYear(maxYear)}`;
}
