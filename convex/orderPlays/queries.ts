import { v } from "convex/values";
import { query } from "../_generated/server";
import { isCompletedPlay } from "../lib/playCompletion";
import { getAuthenticatedUser } from "../users/helpers";

export const getOrderPlay = query({
  args: {
    userId: v.id("users"),
    puzzleId: v.id("orderPuzzles"),
  },
  handler: async (ctx, { userId, puzzleId }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user._id !== userId) return null;
    const play = await ctx.db
      .query("orderPlays")
      .withIndex("by_user_puzzle", (q) => q.eq("userId", user._id).eq("puzzleId", puzzleId))
      .first();

    return play;
  },
});

export const getUserCompletedOrderPlays = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user._id !== userId) return [];
    const plays = await ctx.db
      .query("orderPlays")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const completedPlays = plays.filter(isCompletedPlay);

    return completedPlays;
  },
});
