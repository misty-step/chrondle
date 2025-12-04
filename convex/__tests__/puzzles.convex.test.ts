import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Type assertion for path-based API access (works at runtime, not type-checked)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const puzzlesQueries = (api as any)["puzzles/queries"];

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
