import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Type assertion for path-based API access (works at runtime, not type-checked)

const puzzlesQueries = (api as any)["puzzles/queries"];

const puzzlesMutations = (api as any)["puzzles/mutations"];

const playsQueries = (api as any)["plays/queries"];

/**
 * Puzzle Query Tests using convex-test
 *
 * Tests the puzzle retrieval queries with a mock database.
 * Pattern: Seed data → Execute query → Assert results
 */

describe("puzzles/queries", () => {
  describe("getDailyPuzzle", () => {
    it("returns puzzle for today's date", async () => {
      const t = convexTest(schema, modules);
      const today = new Date().toISOString().slice(0, 10);

      // Seed today's puzzle
      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: today,
          targetYear: 1969,
          events: [
            "Moon landing",
            "Woodstock",
            "Abbey Road",
            "ARPANET",
            "Concorde",
            "Sesame Street",
          ],
          playCount: 100,
          avgGuesses: 3.5,
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(api.puzzles.getDailyPuzzle, {});

      expect(puzzle).not.toBeNull();
      expect(puzzle?.targetYear).toBe(1969);
      expect(puzzle?.puzzleNumber).toBe(1);
    });

    it("returns null when no puzzle for today", async () => {
      const t = convexTest(schema, modules);

      // Seed a puzzle for a different date
      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2020-01-01",
          targetYear: 1945,
          events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
          playCount: 50,
          avgGuesses: 2.0,
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(api.puzzles.getDailyPuzzle, {});

      expect(puzzle).toBeNull();
    });
  });

  describe("getPuzzleByNumber", () => {
    it("returns puzzle by sequential number", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 42,
          date: "2024-03-15",
          targetYear: 1776,
          events: ["Declaration signed", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
          playCount: 200,
          avgGuesses: 4.0,
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(api.puzzles.getPuzzleByNumber, {
        puzzleNumber: 42,
      });

      expect(puzzle).not.toBeNull();
      expect(puzzle?.targetYear).toBe(1776);
      expect(puzzle?.date).toBe("2024-03-15");
    });

    it("returns null for non-existent puzzle number", async () => {
      const t = convexTest(schema, modules);

      const puzzle = await t.query(api.puzzles.getPuzzleByNumber, {
        puzzleNumber: 999,
      });

      expect(puzzle).toBeNull();
    });
  });

  describe("getPuzzleById", () => {
    it("returns puzzle by Convex ID", async () => {
      const t = convexTest(schema, modules);

      let puzzleId: Id<"puzzles">;
      await t.run(async (ctx) => {
        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 2000,
          events: ["Y2K", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
          playCount: 500,
          avgGuesses: 2.5,
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(api.puzzles.getPuzzleById, {
        puzzleId: puzzleId!,
      });

      expect(puzzle).not.toBeNull();
      expect(puzzle?.targetYear).toBe(2000);
    });
  });

  describe("getArchivePuzzles", () => {
    it("returns paginated puzzles sorted by number (newest first)", async () => {
      const t = convexTest(schema, modules);

      // Seed 5 puzzles
      await t.run(async (ctx) => {
        for (let i = 1; i <= 5; i++) {
          await ctx.db.insert("puzzles", {
            puzzleNumber: i,
            date: `2024-01-0${i}`,
            targetYear: 1900 + i * 10,
            events: ["E1", "E2", "E3", "E4", "E5", "E6"],
            playCount: i * 10,
            avgGuesses: 3.0,
            updatedAt: Date.now(),
          });
        }
      });

      const result = await t.query(api.puzzles.getArchivePuzzles, {
        page: 1,
        pageSize: 2,
      });

      expect(result.totalCount).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(1);
      expect(result.puzzles).toHaveLength(2);
    });

    it("returns empty array for page beyond range", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 1950,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 10,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.puzzles.getArchivePuzzles, {
        page: 10,
        pageSize: 10,
      });

      expect(result.puzzles).toHaveLength(0);
      expect(result.totalCount).toBe(1);
    });

    it("filters out puzzles after maxDate when provided", async () => {
      const t = convexTest(schema, modules);

      // Seed puzzles for Dec 23, 24, 25
      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 133,
          date: "2025-12-23",
          targetYear: 1800,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 10,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 134,
          date: "2025-12-24",
          targetYear: 1900,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 10,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 135,
          date: "2025-12-25",
          targetYear: 2000,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 10,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
      });

      // Query with maxDate = Dec 24 (should exclude Dec 25)
      const result = await t.query(api.puzzles.getArchivePuzzles, {
        page: 1,
        pageSize: 10,
        maxDate: "2025-12-24",
      });

      expect(result.totalCount).toBe(2); // Only Dec 23 and Dec 24
      expect(result.puzzles).toHaveLength(2);
      expect(result.puzzles.map((p: { puzzleNumber: number }) => p.puzzleNumber)).toEqual([
        134, 133,
      ]);
    });

    it("returns all puzzles when maxDate is not provided (backward compat)", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 134,
          date: "2025-12-24",
          targetYear: 1900,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 10,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 135,
          date: "2025-12-25",
          targetYear: 2000,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 10,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
      });

      // Query without maxDate (backward compatible)
      const result = await t.query(api.puzzles.getArchivePuzzles, {
        page: 1,
        pageSize: 10,
      });

      expect(result.totalCount).toBe(2); // Both puzzles
      expect(result.puzzles).toHaveLength(2);
    });
  });

  describe("getTotalPuzzles", () => {
    it("returns count of all puzzles", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 1990,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 2,
          date: "2024-01-02",
          targetYear: 1991,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 150,
          avgGuesses: 2.8,
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.puzzles.getTotalPuzzles, {});

      expect(result.count).toBe(2);
    });

    it("returns zero when no puzzles exist", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.puzzles.getTotalPuzzles, {});

      expect(result.count).toBe(0);
    });
  });

  describe("getPuzzleYears", () => {
    it("returns unique years sorted descending", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 2,
          date: "2024-01-02",
          targetYear: 1945,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 3,
          date: "2024-01-03",
          targetYear: 1969, // Duplicate year
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.puzzles.getPuzzleYears, {});

      expect(result.years).toEqual([1969, 1945]); // Unique, descending
    });

    it("returns empty array when no puzzles exist", async () => {
      const t = convexTest(schema, modules);

      const result = await t.query(api.puzzles.getPuzzleYears, {});

      expect(result.years).toEqual([]);
    });
  });

  describe("getAllPuzzles (puzzles/queries)", () => {
    it("returns all puzzles", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          targetYear: 1990,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 100,
          avgGuesses: 3.0,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("puzzles", {
          puzzleNumber: 2,
          date: "2024-01-02",
          targetYear: 2000,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 200,
          avgGuesses: 2.5,
          updatedAt: Date.now(),
        });
      });

      // Access via puzzles/queries path (not re-exported in barrel)
      const puzzles = await t.query(puzzlesQueries.getAllPuzzles, {});

      expect(puzzles).toHaveLength(2);
    });
  });
});

/**
 * Puzzle Mutation Tests using convex-test
 *
 * Tests game state mutations with authoritative scoring.
 */

describe("puzzles/mutations", () => {
  describe("submitGuess", () => {
    it("creates new play record on first guess", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "guess_test_1",
          email: "guess@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2024-01-15",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(puzzlesMutations.submitGuess, {
        puzzleId: puzzleId!,
        userId: userId!,
        guess: 1970,
      });

      expect(result.correct).toBe(false);
      expect(result.guesses).toEqual([1970]);
      expect(result.targetYear).toBe(1969);
    });

    it("returns correct: true on exact match", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "guess_test_2",
          email: "correct@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 2,
          date: "2024-01-15",
          targetYear: 1945,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(puzzlesMutations.submitGuess, {
        puzzleId: puzzleId!,
        userId: userId!,
        guess: 1945,
      });

      expect(result.correct).toBe(true);
      expect(result.guesses).toEqual([1945]);
    });

    it("throws error on completed puzzle", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "guess_test_3",
          email: "completed@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 3,
          date: "2024-01-15",
          targetYear: 2000,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });

        // Create completed play
        await ctx.db.insert("plays", {
          userId,
          puzzleId,
          guesses: [2000],
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(puzzlesMutations.submitGuess, {
          puzzleId: puzzleId!,
          userId: userId!,
          guess: 2001,
        }),
      ).rejects.toThrow("Puzzle already completed");
    });

    it("throws error when max attempts reached", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "guess_test_4",
          email: "maxed@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 4,
          date: "2024-01-15",
          targetYear: 1990,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });

        // Create play with 6 wrong guesses
        await ctx.db.insert("plays", {
          userId,
          puzzleId,
          guesses: [1980, 1981, 1982, 1983, 1984, 1985],
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(puzzlesMutations.submitGuess, {
          puzzleId: puzzleId!,
          userId: userId!,
          guess: 1990,
        }),
      ).rejects.toThrow("Maximum attempts reached");
    });
  });

  describe("submitRange", () => {
    it("creates play record with correct range on first submission", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "range_test_1",
          email: "range@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 10,
          date: "2024-01-15",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(puzzlesMutations.submitRange, {
        puzzleId: puzzleId!,
        userId: userId!,
        start: 1960,
        end: 1980,
        hintsUsed: 0,
      });

      expect(result.contained).toBe(true);
      expect(result.range.start).toBe(1960);
      expect(result.range.end).toBe(1980);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.attemptsRemaining).toBe(5);
    });

    it("normalizes inverted range bounds", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "range_test_2",
          email: "inverted@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 11,
          date: "2024-01-15",
          targetYear: 1945,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });
      });

      // Submit with end < start (inverted)
      const result = await t.mutation(puzzlesMutations.submitRange, {
        puzzleId: puzzleId!,
        userId: userId!,
        start: 1950, // Higher value first
        end: 1940, // Lower value second
        hintsUsed: 1,
      });

      // Should be normalized to 1940-1950
      expect(result.range.start).toBe(1940);
      expect(result.range.end).toBe(1950);
      expect(result.contained).toBe(true);
    });

    it("returns contained: false when target not in range", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "range_test_3",
          email: "miss@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 12,
          date: "2024-01-15",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(puzzlesMutations.submitRange, {
        puzzleId: puzzleId!,
        userId: userId!,
        start: 1980,
        end: 2000,
        hintsUsed: 2,
      });

      expect(result.contained).toBe(false);
      expect(result.totalScore).toBe(0);
      expect(result.attemptsRemaining).toBe(5);
    });

    it("accumulates ranges on subsequent submissions", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let puzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "range_test_4",
          email: "multi@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 13,
          date: "2024-01-15",
          targetYear: 1969,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });

        // Create play with one failed range
        await ctx.db.insert("plays", {
          userId,
          puzzleId,
          ranges: [{ start: 1980, end: 2000, hintsUsed: 0, score: 0, timestamp: Date.now() }],
          totalScore: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(puzzlesMutations.submitRange, {
        puzzleId: puzzleId!,
        userId: userId!,
        start: 1960,
        end: 1975,
        hintsUsed: 1,
      });

      expect(result.ranges).toHaveLength(2);
      expect(result.attemptsRemaining).toBe(4);
      expect(result.contained).toBe(true);
    });

    it("throws error on non-existent puzzle", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      let fakePuzzleId: Id<"puzzles">;

      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "range_test_5",
          email: "nopuzzle@test.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });

        // Create and delete puzzle to get valid ID format
        fakePuzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 999,
          date: "2024-01-15",
          targetYear: 1900,
          events: ["E1", "E2", "E3", "E4", "E5", "E6"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });
        await ctx.db.delete(fakePuzzleId);
      });

      await expect(
        t.mutation(puzzlesMutations.submitRange, {
          puzzleId: fakePuzzleId!,
          userId: userId!,
          start: 1960,
          end: 1980,
          hintsUsed: 0,
        }),
      ).rejects.toThrow("Puzzle not found");
    });
  });
});
