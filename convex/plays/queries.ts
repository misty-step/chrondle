import { v } from "convex/values";
import { query } from "../_generated/server";
import { normalizePlayData } from "../lib/migrationHelpers";

/**
 * Play Progress Queries
 *
 * Module: Single responsibility - read user play data
 * Deep Module Value: Hides play record query complexity behind simple API
 *
 * Exports:
 * - getUserPlay: Get user's play record for a specific puzzle
 * - getUserCompletedPuzzles: Get all completed puzzles for a user
 */

/**
 * Get user's play record for a specific puzzle
 *
 * Returns the play record containing guesses and completion status.
 * Used by frontend to show game progress and enable resume functionality.
 *
 * Defensive programming: Returns null on errors for graceful degradation.
 *
 * @param puzzleId - Puzzle being queried
 * @param userId - User whose play record to fetch
 * @returns Play record or null if not found/error
 */
export const getUserPlay = query({
  args: {
    puzzleId: v.id("puzzles"),
    userId: v.id("users"),
  },
  handler: async (ctx, { puzzleId, userId }) => {
    try {
      // Validate input parameters
      if (!puzzleId || !userId) {
        console.warn("[getUserPlay] Missing required parameters:", {
          puzzleId: puzzleId ? "provided" : "missing",
          userId: userId ? "provided" : "missing",
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      // Additional validation: Check if the IDs are valid format
      // Convex IDs are strings, so we check they're non-empty strings
      if (typeof puzzleId !== "string" || typeof userId !== "string") {
        console.warn("[getUserPlay] Invalid parameter types:", {
          puzzleIdType: typeof puzzleId,
          userIdType: typeof userId,
          timestamp: new Date().toISOString(),
        });
        return null;
      }

      // Perform the query with defensive programming
      const play = await ctx.db
        .query("plays")
        .withIndex("by_user_puzzle", (q) => q.eq("userId", userId).eq("puzzleId", puzzleId))
        .first();

      const normalizedPlay = normalizePlayData(play);

      if (!normalizedPlay) {
        return null;
      }

      // Log successful query in development for debugging
      if (process.env.NODE_ENV === "development") {
        console.error("[getUserPlay] Successfully retrieved play record:", {
          userId: userId.slice(0, 8) + "...", // Log partial ID for privacy
          puzzleId: puzzleId.slice(0, 8) + "...",
          attempts: normalizedPlay.ranges.length,
          isCompleted: !!normalizedPlay.completedAt,
        });
      }

      return normalizedPlay;
    } catch (error) {
      // Log the error with context for debugging
      console.error("[getUserPlay] Error fetching user play record:", {
        error: error instanceof Error ? error.message : String(error),
        userId: userId ? userId.slice(0, 8) + "..." : "undefined",
        puzzleId: puzzleId ? puzzleId.slice(0, 8) + "..." : "undefined",
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Return null instead of throwing to allow graceful degradation
      // The client can handle null as "no play record found"
      return null;
    }
  },
});

/**
 * Get all completed puzzles for a user
 *
 * Returns all play records where the user successfully completed the puzzle.
 * Used by archive page to show which puzzles user has finished.
 *
 * @param userId - User whose completed puzzles to fetch
 * @returns Array of completed play records
 */
export const getUserCompletedPuzzles = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const completedPlays = await ctx.db
      .query("plays")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("completedAt"), null))
      .collect();

    return completedPlays;
  },
});
