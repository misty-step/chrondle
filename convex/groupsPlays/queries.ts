import { v } from "convex/values";
import { query } from "../_generated/server";
import { isGroupsPuzzleComplete, MAX_GROUPS_MISTAKES } from "../groupsPuzzles/logic";

export const getGroupsPlay = query({
  args: {
    userId: v.id("users"),
    puzzleId: v.id("groupsPuzzles"),
  },
  handler: async (ctx, { userId, puzzleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db.get(userId);
    if (!user || user.clerkId !== identity.subject) {
      throw new Error("Forbidden");
    }

    const play = await ctx.db
      .query("groupsPlays")
      .withIndex("by_user_puzzle", (q) => q.eq("userId", userId).eq("puzzleId", puzzleId))
      .first();

    if (!play) {
      return null;
    }

    const puzzle = await ctx.db.get(puzzleId);
    if (!puzzle) {
      throw new Error("Groups puzzle not found");
    }

    const hasWon = isGroupsPuzzleComplete(puzzle.groups, play.solvedGroupIds);
    const revealAll = hasWon || play.mistakes >= MAX_GROUPS_MISTAKES;
    const solved = new Set(play.solvedGroupIds);

    return {
      ...play,
      remainingMistakes: Math.max(0, MAX_GROUPS_MISTAKES - play.mistakes),
      hasWon,
      isComplete: hasWon || play.mistakes >= MAX_GROUPS_MISTAKES,
      revealedGroups: puzzle.groups
        .filter((group) => revealAll || solved.has(group.id))
        .map((group) => ({
          id: group.id,
          year: group.year,
          tier: group.tier,
          eventIds: group.eventIds,
        })),
    };
  },
});

export const getUserCompletedGroupsPlays = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const plays = await ctx.db
      .query("groupsPlays")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return plays.filter((play) => play.completedAt !== undefined && play.completedAt !== null);
  },
});
