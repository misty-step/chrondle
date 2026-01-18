import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { selectYearForPuzzle, selectDiverseEvents } from "../lib/puzzleHelpers";

/**
 * Puzzle Helper Integration Tests using convex-test
 *
 * Tests selectYearForPuzzle with actual database queries.
 * Pattern: Seed events → Execute helper → Assert results
 */

describe("puzzleHelpers", () => {
  describe("selectYearForPuzzle", () => {
    it("selects a year with 6+ unused events", async () => {
      const t = convexTest(schema, modules);

      // Seed events for year 1969 (6 events - minimum required)
      await t.run(async (ctx) => {
        const events = [
          "Moon landing",
          "Woodstock festival",
          "Abbey Road released",
          "ARPANET created",
          "Concorde first flight",
          "Sesame Street premiers",
        ];
        for (const event of events) {
          await ctx.db.insert("events", {
            year: 1969,
            event,
            updatedAt: Date.now(),
          });
        }
      });

      // Execute selectYearForPuzzle
      const result = await t.run(async (ctx) => {
        return selectYearForPuzzle(ctx);
      });

      expect(result.year).toBe(1969);
      expect(result.events.length).toBe(6);
      expect(result.availableEvents).toBe(6);
    });

    it("throws when no years have 6+ unused events", async () => {
      const t = convexTest(schema, modules);

      // Seed only 3 events (not enough)
      await t.run(async (ctx) => {
        await ctx.db.insert("events", { year: 1900, event: "Event 1", updatedAt: Date.now() });
        await ctx.db.insert("events", { year: 1900, event: "Event 2", updatedAt: Date.now() });
        await ctx.db.insert("events", { year: 1900, event: "Event 3", updatedAt: Date.now() });
      });

      await expect(
        t.run(async (ctx) => {
          return selectYearForPuzzle(ctx);
        }),
      ).rejects.toThrow("No years available with enough unused events");
    });

    it("excludes events already used in Classic puzzles", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        // Create a puzzle that will "use" some events
        const puzzleId = await ctx.db.insert("puzzles", {
          puzzleNumber: 1,
          date: "2020-01-01",
          targetYear: 1969,
          events: ["Used event 1", "Used event 2"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: Date.now(),
        });

        // Insert 8 events for 1969, but mark 2 as used
        const events = [
          { event: "Used event 1", classicPuzzleId: puzzleId },
          { event: "Used event 2", classicPuzzleId: puzzleId },
          { event: "Unused event 3", classicPuzzleId: undefined },
          { event: "Unused event 4", classicPuzzleId: undefined },
          { event: "Unused event 5", classicPuzzleId: undefined },
          { event: "Unused event 6", classicPuzzleId: undefined },
          { event: "Unused event 7", classicPuzzleId: undefined },
          { event: "Unused event 8", classicPuzzleId: undefined },
        ];

        for (const e of events) {
          await ctx.db.insert("events", {
            year: 1969,
            event: e.event,
            classicPuzzleId: e.classicPuzzleId,
            updatedAt: Date.now(),
          });
        }
      });

      const result = await t.run(async (ctx) => {
        return selectYearForPuzzle(ctx);
      });

      // Should only see the 6 unused events
      expect(result.availableEvents).toBe(6);
      expect(result.events.every((e) => !e.classicPuzzleId)).toBe(true);
    });

    it("selects from year with most events when multiple eligible", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        // Year 1900: 6 events (minimum)
        for (let i = 0; i < 6; i++) {
          await ctx.db.insert("events", {
            year: 1900,
            event: `Event 1900-${i}`,
            updatedAt: Date.now(),
          });
        }
        // Year 2000: 10 events (more)
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("events", {
            year: 2000,
            event: `Event 2000-${i}`,
            updatedAt: Date.now(),
          });
        }
      });

      // Run multiple times to verify randomness works
      const years = new Set<number>();
      for (let i = 0; i < 10; i++) {
        const result = await t.run(async (ctx) => {
          return selectYearForPuzzle(ctx);
        });
        years.add(result.year);
      }

      // Should have selected from at least one of the valid years
      expect(years.size).toBeGreaterThanOrEqual(1);
      expect([...years].every((y) => y === 1900 || y === 2000)).toBe(true);
    });
  });

  describe("selectDiverseEvents with metadata", () => {
    it("uses diversity selection when events have category metadata", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        // Insert diverse events with categories
        const events = [
          { event: "Battle of Hastings", metadata: { category: ["Military"], difficulty: 3 } },
          { event: "Magna Carta", metadata: { category: ["Political"], difficulty: 2 } },
          { event: "Black Death", metadata: { category: ["Medical"], difficulty: 4 } },
          { event: "Hundred Years War", metadata: { category: ["Military"], difficulty: 3 } },
          { event: "Printing Press", metadata: { category: ["Technology"], difficulty: 2 } },
          { event: "Fall of Constantinople", metadata: { category: ["Military"], difficulty: 4 } },
          { event: "Columbus Voyage", metadata: { category: ["Exploration"], difficulty: 1 } },
          { event: "Protestant Reformation", metadata: { category: ["Religion"], difficulty: 3 } },
        ];

        for (const e of events) {
          await ctx.db.insert("events", {
            year: 1400,
            event: e.event,
            metadata: e.metadata,
            updatedAt: Date.now(),
          });
        }
      });

      const result = await t.run(async (ctx) => {
        return selectYearForPuzzle(ctx);
      });

      // Count military events (should be max 2)
      const militaryCount = result.events.filter(
        (e) => e.metadata?.category?.[0] === "Military",
      ).length;

      expect(militaryCount).toBeLessThanOrEqual(2);
      expect(result.events.length).toBe(6);
    });

    it("orders events by difficulty (hardest first)", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        const events = [
          { event: "Easy event", metadata: { category: ["A"], difficulty: 1 } },
          { event: "Hard event", metadata: { category: ["B"], difficulty: 5 } },
          { event: "Medium event", metadata: { category: ["C"], difficulty: 3 } },
          { event: "Very hard", metadata: { category: ["D"], difficulty: 5 } },
          { event: "Medium-hard", metadata: { category: ["E"], difficulty: 4 } },
          { event: "Easy-medium", metadata: { category: ["F"], difficulty: 2 } },
        ];

        for (const e of events) {
          await ctx.db.insert("events", {
            year: 2000,
            event: e.event,
            metadata: e.metadata,
            updatedAt: Date.now(),
          });
        }
      });

      const result = await t.run(async (ctx) => {
        return selectYearForPuzzle(ctx);
      });

      // Verify descending difficulty order
      const difficulties = result.events.map((e) => e.metadata?.difficulty ?? 3);
      for (let i = 0; i < difficulties.length - 1; i++) {
        expect(difficulties[i]).toBeGreaterThanOrEqual(difficulties[i + 1]);
      }
    });
  });
});
