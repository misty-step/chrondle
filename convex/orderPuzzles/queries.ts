import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Order Puzzle Retrieval Queries.
 * Mirrors Classic puzzle APIs while targeting the orderPuzzles table.
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
  },
  handler: async (ctx, { page, pageSize }) => {
    // Get total count
    const allPuzzles = await ctx.db.query("orderPuzzles").collect();
    const totalCount = allPuzzles.length;

    // Get puzzles sorted by puzzle number (newest first)
    const puzzles = await ctx.db.query("orderPuzzles").order("desc").collect();

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
