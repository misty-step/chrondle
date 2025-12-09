import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Type assertion for path-based API access (works at runtime, not type-checked)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playsQueries = (api as any)["plays/queries"];

/**
 * Plays Query Tests using convex-test
 *
 * Tests the play retrieval queries with a mock database.
 * Pattern: Seed data → Execute query → Assert results
 */

describe("plays/queries", () => {
  describe("getUserPlay", () => {
    it("returns play record for user and puzzle", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        // Create user
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_test_user_1",
          email: "test@example.com",
          currentStreak: 5,
          longestStreak: 10,
          totalPlays: 15,
          perfectGames: 3,
          updatedAt: Date.now(),
        });

        // Create puzzle
        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });

        // Create play record
        await ctx.db.insert("plays", {
          userId,
          puzzleId,
          ranges: [
            {
              start: 1960,
              end: 1980,
              hintsUsed: 1,
              score: 85,
              timestamp: Date.now(),
            },
          ],
          totalScore: 85,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const play = await t.query(playsQueries.getUserPlay, {
        userId: userId!,
        puzzleId: puzzleId!,
      });

      expect(play).not.toBeNull();
      expect(play?.totalScore).toBe(85);
      expect(play?.ranges).toHaveLength(1);
    });

    it("returns null when play record does not exist", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        // Create user but no play record
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_test_user_2",
          email: "test2@example.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 2,
          date: "2024-01-02",
          targetYear: 1945,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 50,
          avgGuesses: 2.5,
          updatedAt: Date.now(),
        });
      });

      const play = await t.query(playsQueries.getUserPlay, {
        userId: userId!,
        puzzleId: puzzleId!,
      });

      expect(play).toBeNull();
    });

    it("returns in-progress play without completedAt", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_test_user_3",
          email: "test3@example.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 3,
          date: "2024-01-03",
          targetYear: 2000,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 75,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });

        // In-progress play (no completedAt)
        await ctx.db.insert("plays", {
          userId,
          puzzleId,
          ranges: [
            {
              start: 1990,
              end: 2010,
              hintsUsed: 2,
              score: 0, // Failed attempt
              timestamp: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        });
      });

      const play = await t.query(playsQueries.getUserPlay, {
        userId: userId!,
        puzzleId: puzzleId!,
      });

      expect(play).not.toBeNull();
      expect(play?.completedAt).toBeUndefined();
      expect(play?.ranges).toHaveLength(1);
    });
  });

  describe("getUserCompletedPuzzles", () => {
    it("returns all completed puzzles for user", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_test_user_4",
          email: "test4@example.com",
          currentStreak: 2,
          longestStreak: 5,
          totalPlays: 3,
          perfectGames: 1,
          updatedAt: Date.now(),
        });

        // Create 3 puzzles
        const puzzle1 = await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });

        const puzzle2 = await ctx.db.insert("puzzles", {
          puzzleNumber: 2,
          date: "2024-01-02",
          targetYear: 1945,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });

        const puzzle3 = await ctx.db.insert("puzzles", {
          puzzleNumber: 3,
          date: "2024-01-03",
          targetYear: 2000,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });

        // Completed puzzle 1
        await ctx.db.insert("plays", {
          userId,
          puzzleId: puzzle1,
          ranges: [{ start: 1960, end: 1980, hintsUsed: 1, score: 85, timestamp: Date.now() }],
          totalScore: 85,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Completed puzzle 2
        await ctx.db.insert("plays", {
          userId,
          puzzleId: puzzle2,
          ranges: [{ start: 1940, end: 1950, hintsUsed: 0, score: 100, timestamp: Date.now() }],
          totalScore: 100,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });

        // In-progress puzzle 3 (not completed - completedAt is null)
        await ctx.db.insert("plays", {
          userId,
          puzzleId: puzzle3,
          ranges: [{ start: 1990, end: 2010, hintsUsed: 2, score: 0, timestamp: Date.now() }],
          completedAt: undefined, // Explicitly undefined/not set
          updatedAt: Date.now(),
        });
      });

      const completedPlays = await t.query(playsQueries.getUserCompletedPuzzles, {
        userId: userId!,
      });

      // TODO(#71): Convex neq(completedAt, null) incorrectly matches undefined - should be 2 when fixed
      // Current behavior: Returns 3 plays (2 with completedAt set + 1 with completedAt undefined)
      // Expected behavior: Should return only 2 plays with completedAt actually set
      // This assertion will need updating to toHaveLength(2) when the query filter is corrected.
      // See: https://github.com/misty-step/chrondle/issues/71
      expect(completedPlays).toHaveLength(3);
    });

    it("returns empty array when user has no completed puzzles", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_test_user_5",
          email: "test5@example.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const completedPlays = await t.query(playsQueries.getUserCompletedPuzzles, {
        userId: userId!,
      });

      expect(completedPlays).toHaveLength(0);
    });
  });
});
