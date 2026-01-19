import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

/**
 * User Mutations - User Management Operations
 *
 * Module: Single responsibility - user CRUD operations
 * Deep Module Value: Hides user creation complexity behind simple interface
 *
 * Exports:
 * - createUser: Internal mutation for user creation (called by webhooks)
 * - getOrCreateCurrentUser: JIT user creation for authenticated users
 * - updateUsername: Update user's display name
 *
 * Dependencies:
 * - Convex auth: getUserIdentity() for authentication
 * - Database: users table
 */

/**
 * Create a new user (internal version)
 *
 * Called by Clerk webhooks to create user records.
 * Returns existing user ID if user already exists.
 */
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { clerkId, email }) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new user with schema-compliant fields
    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      username: undefined, // Optional, can be set later
      currentStreak: 0,
      longestStreak: 0,
      totalPlays: 0,
      perfectGames: 0,
      updatedAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Get or create current user (JIT user creation)
 *
 * Creates user record on-demand for authenticated users.
 * Extracts email and username from Clerk identity.
 * Returns existing user if already created.
 */
export const getOrCreateCurrentUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated - cannot create user without Clerk identity");
    }

    try {
      // Check if user already exists
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (existingUser) {
        return existingUser;
      }

      // Create new user with comprehensive field mapping
      // Extract email with proper type handling
      let email = "";
      if (typeof identity.email === "string") {
        email = identity.email;
      } else {
        // Fallback to placeholder email using Clerk ID
        email = `${identity.subject}@placeholder.local`;
      }

      // Extract username with proper type handling
      let username: string | undefined = undefined;
      if (typeof identity.nickname === "string") {
        username = identity.nickname;
      } else if (typeof identity.firstName === "string") {
        username = identity.firstName;
      }

      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email,
        username,
        currentStreak: 0,
        longestStreak: 0,
        totalPlays: 0,
        perfectGames: 0,
        updatedAt: Date.now(),
      });

      // Retrieve and return the created user record
      const newUser = await ctx.db.get(userId);
      if (!newUser) {
        throw new Error("Failed to retrieve newly created user record");
      }

      return newUser;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[getOrCreateCurrentUser] Failed to create user:", {
        error: errorMessage,
        clerkId: identity.subject,
        email: identity.email,
        identityKeys: Object.keys(identity),
        timestamp: new Date().toISOString(),
      });

      // Re-throw error to prevent silent failures
      throw new Error(`User creation failed: ${errorMessage}`);
    }
  },
});

/**
 * Update username
 *
 * Updates authenticated user's display name.
 * Throws error if not authenticated or user not found.
 */
export const updateUsername = mutation({
  args: {
    username: v.string(),
  },
  handler: async (ctx, { username }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      username,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
