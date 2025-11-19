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
