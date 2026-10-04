import { v } from "convex/values";
import { query } from "../_generated/server";
import { isCompletedPlay } from "../lib/playCompletion";

export const getOrderPlay = query({
  args: {
    userId: v.id("users"),
    puzzleId: v.id("orderPuzzles"),
  },
  handler: async (ctx, { userId, puzzleId }) => {
    const play = await ctx.db
      .query("orderPlays")
      .withIndex("by_user_puzzle", (q) => q.eq("userId", userId).eq("puzzleId", puzzleId))
      .first();

    return play;
  },
});

export const getUserCompletedOrderPlays = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const plays = await ctx.db
      .query("orderPlays")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const completedPlays = plays.filter(isCompletedPlay);

    return completedPlays;
  },
});
