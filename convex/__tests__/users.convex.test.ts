import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Type assertion for path-based API access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const usersQueries = (api as any)["users/queries"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const usersMutations = (api as any)["users/mutations"];

/**
 * Users Query and Mutation Tests using convex-test
 *
 * Tests user management operations with a mock database.
 * Note: Auth-dependent operations (getCurrentUser, getOrCreateCurrentUser)
 * are harder to test with convex-test - focus on non-auth operations.
 */

describe("users/queries", () => {
  describe("getUserByClerkId", () => {
    it("returns user when found", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "clerk_test_123",
          email: "test@example.com",
          currentStreak: 5,
          longestStreak: 10,
          totalPlays: 15,
          perfectGames: 3,
          updatedAt: Date.now(),
        });
      });

      const user = await t.query(usersQueries.getUserByClerkId, {
        clerkId: "clerk_test_123",
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe("test@example.com");
      expect(user?.currentStreak).toBe(5);
    });

    it("returns null when user not found", async () => {
      const t = convexTest(schema, modules);

      const user = await t.query(usersQueries.getUserByClerkId, {
        clerkId: "nonexistent_clerk_id",
      });

      expect(user).toBeNull();
    });
  });

  describe("userExists", () => {
    it("returns exists: true when user found by clerkId", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_exists_test",
          email: "exists@example.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(usersQueries.userExists, {
        clerkId: "clerk_exists_test",
      });

      expect(result.exists).toBe(true);
      expect(result.email).toBe("exists@example.com");
      expect(result.clerkId).toBe("clerk_exists_test");
    });

    it("returns exists: false when user not found", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(usersQueries.userExists, {
        clerkId: "nonexistent_clerk",
      });

      expect(result.exists).toBe(false);
      expect(result.clerkId).toBe("nonexistent_clerk");
    });
  });
});

describe("users/mutations", () => {
  describe("createUserFromWebhook", () => {
    it("creates new user with initial stats", async () => {
      const t = convexTest(schema, modules);

      const userId = await t.mutation(usersMutations.createUserFromWebhook, {
        clerkId: "new_user_clerk_id",
        email: "newuser@example.com",
      });

      expect(userId).toBeDefined();

      // Verify user was created with correct initial values
      const user = await t.query(usersQueries.getUserByClerkId, {
        clerkId: "new_user_clerk_id",
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe("newuser@example.com");
      expect(user?.currentStreak).toBe(0);
      expect(user?.longestStreak).toBe(0);
      expect(user?.totalPlays).toBe(0);
      expect(user?.perfectGames).toBe(0);
    });

    it("returns existing user ID if user already exists", async () => {
      const t = convexTest(schema, modules);

      let existingUserId: Id<"users">;
      await t.run(async (ctx) => {
        existingUserId = await ctx.db.insert("users", {
          clerkId: "existing_clerk_id",
          email: "existing@example.com",
          currentStreak: 10,
          longestStreak: 20,
          totalPlays: 50,
          perfectGames: 5,
          updatedAt: Date.now(),
        });
      });

      // Try to create same user via webhook
      const returnedId = await t.mutation(usersMutations.createUserFromWebhook, {
        clerkId: "existing_clerk_id",
        email: "different@example.com", // Different email shouldn't matter
      });

      expect(returnedId).toBe(existingUserId!);

      // Verify original user data unchanged
      const user = await t.query(usersQueries.getUserByClerkId, {
        clerkId: "existing_clerk_id",
      });

      expect(user?.email).toBe("existing@example.com"); // Original email preserved
      expect(user?.currentStreak).toBe(10); // Original stats preserved
    });
  });
});
