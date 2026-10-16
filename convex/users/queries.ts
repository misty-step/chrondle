import { v } from "convex/values";
import { query } from "../_generated/server";
import { checkArchiveAccess, getAuthenticatedUser } from "./helpers";

/**
 * User Queries - Read-Only User Access
 *
 * Module: Single responsibility - user data retrieval
 * Deep Module Value: Hides database query complexity behind simple interface
 *
 * Exports:
 * - getCurrentUser: Get authenticated user data
 * - getUserByClerkId: Compatibility lookup for the authenticated user's own ID
 * - userExists: Check the authenticated user's own account
 * - getUserStats: Get user statistics with recent play history
 * - hasArchiveAccess: Check if user has paid archive access
 *
 * Dependencies:
 * - Convex auth: getUserIdentity() for authentication
 * - Database: users and plays tables
 */

/**
 * Get current authenticated user
 *
 * Returns null if not authenticated or user not found.
 * Used by frontend to load user data on initial page load.
 */
export const getCurrentUser = query({
  handler: getAuthenticatedUser,
});

/**
 * Get user by Clerk ID
 *
 * Compatibility endpoint for existing clients. Webhooks use their verified
 * gateways and internal mutations, not this public account query.
 */
export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, { clerkId }) => {
    const user = await getAuthenticatedUser(ctx);
    return user?.clerkId === clerkId ? user : null;
  },
});

/**
 * Check if user exists
 *
 * Legacy clerkId is accepted only when it matches the authenticated owner.
 */
export const userExists = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || (clerkId !== undefined && clerkId !== user.clerkId)) {
      return { exists: false };
    }
    return { exists: true, userId: user._id, clerkId: user.clerkId, email: user.email };
  },
});

/**
 * Get user statistics with recent play history
 *
 * Returns user data with:
 * - Recent plays (last 20)
 * - Completion rate calculation
 * - All user stats (streaks, totals)
 *
 * Returns null if not authenticated or user not found.
 */
export const getUserStats = query({
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);

    if (!user) {
      return null;
    }

    // Get user's play history
    const plays = await ctx.db
      .query("plays")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);

    return {
      ...user,
      recentPlays: plays,
      completionRate:
        user.totalPlays > 0
          ? Math.round((plays.filter((p) => p.completedAt).length / user.totalPlays) * 100)
          : 0,
    };
  },
});

/**
 * Check if user has paid archive access
 *
 * Returns true if:
 * - User is authenticated
 * - User has active subscription
 * - Subscription hasn't expired
 *
 * Used for server-side entitlement gating on archive pages.
 */
export const hasArchiveAccess = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || (clerkId !== undefined && clerkId !== user.clerkId)) {
      return false;
    }

    return checkArchiveAccess(user);
  },
});
