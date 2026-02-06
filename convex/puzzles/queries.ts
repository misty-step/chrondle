import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Puzzle Retrieval Queries
 *
 * Module: Single responsibility - read-only puzzle access
 * Deep Module Value: Hides database query complexity behind clean API
 *
 * Exports:
 * - getDailyPuzzle: Get today's puzzle (UTC)
 * - getPuzzleByDate: Get puzzle for specific date (local date support)
 * - getPuzzleById: Get puzzle by Convex ID
 * - getPuzzleByNumber: Get puzzle by sequential number
 * - getArchivePuzzles: Get paginated archive puzzles
 * - getTotalPuzzles: Get puzzle count
 * - getPuzzleYears: Get unique years in puzzle collection
 */

/**
 * Get puzzle for a specific date
 *
 * Supports local-date puzzle selection: client passes their local date,
 * server returns the puzzle for that date if it exists.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Puzzle document or null if not yet generated
 */
export const getPuzzleByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const puzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    return puzzle;
  },
});

/**
 * Get today's puzzle using UTC date
 *
 * Wrapper around getPuzzleByDate for backward compatibility.
 * For new code, prefer getPuzzleByDate with client's local date.
 *
 * @returns Today's puzzle or null if not yet generated
 */
export const getDailyPuzzle = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);

    const puzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    return puzzle;
  },
});

/**
 * Get puzzle by Convex ID
 * @param puzzleId - Convex puzzle ID
 * @returns Puzzle document or null
 */
export const getPuzzleById = query({
  args: { puzzleId: v.id("puzzles") },
  handler: async (ctx, { puzzleId }) => {
    const puzzle = await ctx.db.get(puzzleId);
    return puzzle;
  },
});

/**
 * Get puzzle by sequential number
 * @param puzzleNumber - Sequential puzzle number (1, 2, 3, ...)
 * @returns Puzzle document or null
 */
export const getPuzzleByNumber = query({
  args: { puzzleNumber: v.number() },
  handler: async (ctx, { puzzleNumber }) => {
    const puzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_number", (q) => q.eq("puzzleNumber", puzzleNumber))
      .first();

    return puzzle;
  },
});

/**
 * Get paginated archive puzzles sorted by number (newest first)
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of puzzles per page
 * @returns Paginated puzzle results with metadata
 */
export const getArchivePuzzles = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    maxDate: v.optional(v.string()), // YYYY-MM-DD: filter out puzzles after this date
  },
  handler: async (ctx, { page, pageSize, maxDate }) => {
    const buildArchiveQuery = () => {
      if (maxDate) {
        return ctx.db
          .query("puzzles")
          .withIndex("by_date", (q) => q.lte("date", maxDate))
          .order("desc");
      }

      return ctx.db.query("puzzles").withIndex("by_number").order("desc");
    };

    const countQueryResults = async (query: AsyncIterable<unknown>) => {
      let count = 0;
      for await (const _ of query) {
        count += 1;
      }
      return count;
    };

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const pageWindow = await buildArchiveQuery().take(endIndex);
    const paginatedPuzzles = pageWindow.slice(startIndex, endIndex);

    let totalCount = pageWindow.length;
    if (pageWindow.length === endIndex) {
      totalCount = await countQueryResults(buildArchiveQuery());
    }

    return {
      puzzles: paginatedPuzzles,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      totalCount,
    };
  },
});

/**
 * Get total number of puzzles in the system
 * @returns Object with count property
 */
export const getTotalPuzzles = query({
  handler: async (ctx) => {
    const puzzles = await ctx.db.query("puzzles").collect();
    return { count: puzzles.length };
  },
});

/**
 * Get all unique years that have puzzles, sorted newest first
 * @returns Object with years array
 */
export const getPuzzleYears = query({
  handler: async (ctx) => {
    const puzzles = await ctx.db.query("puzzles").collect();

    // Extract unique years
    const yearsSet = new Set<number>();
    for (const puzzle of puzzles) {
      yearsSet.add(puzzle.targetYear);
    }

    // Convert to array and sort descending (newest first)
    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return { years };
  },
});

/**
 * Get all puzzles (for demand analysis)
 * @returns Array of all puzzle documents
 */
export const getAllPuzzles = query({
  handler: async (ctx) => {
    return await ctx.db.query("puzzles").collect();
  },
});
