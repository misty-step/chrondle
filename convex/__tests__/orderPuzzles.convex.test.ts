import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

const orderQueries = (api as any)["orderPuzzles/queries"];

/**
 * Order Puzzles Query Tests using convex-test
 *
 * Tests the Order puzzle retrieval queries with a mock database.
 */

describe("orderPuzzles/queries", () => {
  describe("getDailyOrderPuzzle", () => {
    it("returns order puzzle for today's date", async () => {
      const t = convexTest(schema, modules);
      const today = new Date().toISOString().slice(0, 10);

      await t.run(async (ctx) => {
        await ctx.db.insert("orderPuzzles", {
          puzzleNumber: 1,
          date: today,
          events: [
            { id: "event1", year: 1776, text: "American Independence" },
            { id: "event2", year: 1789, text: "French Revolution" },
            { id: "event3", year: 1815, text: "Battle of Waterloo" },
            { id: "event4", year: 1848, text: "Revolutions across Europe" },
            { id: "event5", year: 1861, text: "American Civil War begins" },
            { id: "event6", year: 1914, text: "World War I begins" },
          ],
          seed: "12345",
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(orderQueries.getDailyOrderPuzzle, {});

      expect(puzzle).not.toBeNull();
      expect(puzzle?.puzzleNumber).toBe(1);
      expect(puzzle?.events).toHaveLength(6);
    });

    it("returns null when no order puzzle for today", async () => {
      const t = convexTest(schema, modules);

      // Seed a puzzle for a different date
      await t.run(async (ctx) => {
        await ctx.db.insert("orderPuzzles", {
          puzzleNumber: 1,
          date: "2020-01-01",
          events: [
            { id: "event1", year: 1776, text: "Event 1" },
            { id: "event2", year: 1789, text: "Event 2" },
            { id: "event3", year: 1815, text: "Event 3" },
            { id: "event4", year: 1848, text: "Event 4" },
            { id: "event5", year: 1861, text: "Event 5" },
            { id: "event6", year: 1914, text: "Event 6" },
          ],
          seed: "12345",
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(orderQueries.getDailyOrderPuzzle, {});

      expect(puzzle).toBeNull();
    });
  });

  describe("getOrderPuzzleByNumber", () => {
    it("returns order puzzle by puzzle number", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("orderPuzzles", {
          puzzleNumber: 42,
          date: "2024-03-15",
          events: [
            { id: "event1", year: 1969, text: "Moon landing" },
            { id: "event2", year: 1989, text: "Fall of Berlin Wall" },
            { id: "event3", year: 2000, text: "Y2K" },
            { id: "event4", year: 2001, text: "9/11" },
            { id: "event5", year: 2008, text: "Financial crisis" },
            { id: "event6", year: 2020, text: "COVID-19" },
          ],
          seed: "54321",
          updatedAt: Date.now(),
        });
      });

      const puzzle = await t.query(orderQueries.getOrderPuzzleByNumber, {
        puzzleNumber: 42,
      });

      expect(puzzle).not.toBeNull();
      expect(puzzle?.puzzleNumber).toBe(42);
      expect(puzzle?.date).toBe("2024-03-15");
    });

    it("returns null for non-existent puzzle number", async () => {
      const t = convexTest(schema, modules);

      const puzzle = await t.query(orderQueries.getOrderPuzzleByNumber, {
        puzzleNumber: 999,
      });

      expect(puzzle).toBeNull();
    });
  });

  describe("getArchiveOrderPuzzles", () => {
    it("returns paginated order puzzles sorted by number (newest first)", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        for (let i = 1; i <= 5; i++) {
          await ctx.db.insert("orderPuzzles", {
            puzzleNumber: i,
            date: `2024-01-0${i}`,
            events: [
              { id: `e${i}1`, year: 1700 + i * 50, text: `Event ${i}-1` },
              { id: `e${i}2`, year: 1700 + i * 50 + 10, text: `Event ${i}-2` },
              { id: `e${i}3`, year: 1700 + i * 50 + 20, text: `Event ${i}-3` },
              { id: `e${i}4`, year: 1700 + i * 50 + 30, text: `Event ${i}-4` },
              { id: `e${i}5`, year: 1700 + i * 50 + 40, text: `Event ${i}-5` },
              { id: `e${i}6`, year: 1700 + i * 50 + 50, text: `Event ${i}-6` },
            ],
            seed: String(i * 1000),
            updatedAt: Date.now(),
          });
        }
      });

      const result = await t.query(orderQueries.getArchiveOrderPuzzles, {
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
        await ctx.db.insert("orderPuzzles", {
          puzzleNumber: 1,
          date: "2024-01-01",
          events: [
            { id: "e1", year: 1800, text: "Event 1" },
            { id: "e2", year: 1850, text: "Event 2" },
            { id: "e3", year: 1900, text: "Event 3" },
            { id: "e4", year: 1950, text: "Event 4" },
            { id: "e5", year: 1975, text: "Event 5" },
            { id: "e6", year: 2000, text: "Event 6" },
          ],
          seed: "11111",
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(orderQueries.getArchiveOrderPuzzles, {
        page: 10,
        pageSize: 10,
      });

      expect(result.puzzles).toHaveLength(0);
      expect(result.totalCount).toBe(1);
    });
  });
});
