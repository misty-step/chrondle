import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Order Puzzle Retrieval Queries.
 * Mirrors Classic puzzle APIs while targeting the orderPuzzles table.
 *
 * Exports:
 * - getOrderPuzzleByDate: Get Order puzzle for specific date (local date support)
 * - getDailyOrderPuzzle: Get today's Order puzzle (UTC, backward compat)
 * - getOrderPuzzleByNumber: Get Order puzzle by sequential number
 * - getArchiveOrderPuzzles: Get paginated archive Order puzzles
 */

/**
 * Get Order puzzle for a specific date
 *
 * Supports local-date puzzle selection: client passes their local date,
 * server returns the Order puzzle for that date if it exists.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Order puzzle document or null if not yet generated
 */
export const getOrderPuzzleByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    return await ctx.db
      .query("orderPuzzles")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
  },
});

/**
 * Get today's Order puzzle using UTC date
 *
 * Wrapper for backward compatibility.
 * For new code, prefer getOrderPuzzleByDate with client's local date.
 */
export const getDailyOrderPuzzle = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);

    return await ctx.db
      .query("orderPuzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();
  },
});

export const getOrderPuzzleByNumber = query({
  args: { puzzleNumber: v.number() },
  handler: async (ctx, { puzzleNumber }) => {
    return await ctx.db
      .query("orderPuzzles")
      .withIndex("by_number", (q) => q.eq("puzzleNumber", puzzleNumber))
      .first();
  },
});

/**
 * Get paginated archive order puzzles sorted by number (newest first)
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of puzzles per page
 * @returns Paginated puzzle results with metadata
 */
export const getArchiveOrderPuzzles = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    maxDate: v.optional(v.string()), // YYYY-MM-DD: filter out puzzles after this date
  },
  handler: async (ctx, { page, pageSize, maxDate }) => {
    // Use DB-level filtering with by_date index when maxDate provided
    const puzzles = maxDate
      ? await ctx.db
          .query("orderPuzzles")
          .withIndex("by_date", (q) => q.lte("date", maxDate))
          .collect()
      : await ctx.db.query("orderPuzzles").collect();

    // Sort by puzzleNumber descending (index returns date order)
    puzzles.sort((a, b) => (b.puzzleNumber ?? 0) - (a.puzzleNumber ?? 0));

    const totalCount = puzzles.length;

    // Manual pagination
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPuzzles = puzzles.slice(startIndex, endIndex);

    return {
      puzzles: paginatedPuzzles,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      totalCount,
    };
  },
});
