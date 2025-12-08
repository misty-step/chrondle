import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "../_generated/api";
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

describe("users/statistics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z")); // Monday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("updateUserStats", () => {
    it("increments totalPlays on completion", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "stats_test_1",
          email: "stats@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 5,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.users.statistics.updateUserStats, {
        userId: userId!,
        puzzleCompleted: true,
        guessCount: 3,
        previousPuzzleDate: undefined,
      });

      expect(result.totalPlays).toBe(6);
    });

    it("increments perfectGames on 1-guess completion", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "stats_test_2",
          email: "perfect@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 2,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.users.statistics.updateUserStats, {
        userId: userId!,
        puzzleCompleted: true,
        guessCount: 1, // Perfect game!
        previousPuzzleDate: undefined,
      });

      expect(result.perfectGames).toBe(3);
    });

    it("continues streak when previous puzzle was yesterday", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "streak_test_1",
          email: "streak@test.com",
          currentStreak: 5,
          longestStreak: 10,
          totalPlays: 20,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.users.statistics.updateUserStats, {
        userId: userId!,
        puzzleCompleted: true,
        guessCount: 2,
        previousPuzzleDate: "2024-01-14", // Yesterday
      });

      expect(result.currentStreak).toBe(6);
      expect(result.longestStreak).toBe(10); // Doesn't exceed
    });

    it("updates longestStreak when current exceeds it", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "streak_test_2",
          email: "longest@test.com",
          currentStreak: 9,
          longestStreak: 9,
          totalPlays: 20,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.users.statistics.updateUserStats, {
        userId: userId!,
        puzzleCompleted: true,
        guessCount: 2,
        previousPuzzleDate: "2024-01-14", // Yesterday
      });

      expect(result.currentStreak).toBe(10);
      expect(result.longestStreak).toBe(10); // Now updated!
    });

    it("resets streak to 1 when gap > 1 day", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "streak_test_3",
          email: "gap@test.com",
          currentStreak: 5,
          longestStreak: 10,
          totalPlays: 20,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.users.statistics.updateUserStats, {
        userId: userId!,
        puzzleCompleted: true,
        guessCount: 2,
        previousPuzzleDate: "2024-01-10", // 5 days ago
      });

      expect(result.currentStreak).toBe(1); // Reset to 1
      expect(result.longestStreak).toBe(10); // Preserved
    });

    it("resets streak to 0 on failed puzzle", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "streak_test_4",
          email: "fail@test.com",
          currentStreak: 5,
          longestStreak: 10,
          totalPlays: 20,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.users.statistics.updateUserStats, {
        userId: userId!,
        puzzleCompleted: false, // Failed!
        guessCount: 6,
        previousPuzzleDate: "2024-01-14",
      });

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(10); // Preserved
    });

    it("throws error for non-existent user", async () => {
      const t = convexTest(schema, modules);

      // Create a valid user, get its ID format, then delete it
      let deletedUserId: Id<"users">;
      await t.run(async (ctx) => {
        deletedUserId = await ctx.db.insert("users", {
          clerkId: "to_be_deleted",
          email: "delete@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
        await ctx.db.delete(deletedUserId);
      });

      await expect(
        t.mutation(internal.users.statistics.updateUserStats, {
          userId: deletedUserId!,
          puzzleCompleted: true,
          guessCount: 2,
        }),
      ).rejects.toThrow("User not found");
    });
  });
});
