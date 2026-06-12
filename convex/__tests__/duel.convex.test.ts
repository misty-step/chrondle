import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, it, expect } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

const duelQueries = (anyApi as Record<string, any>)["duel/queries"];

/**
 * Duel Query Tests using convex-test
 *
 * Verifies the public getDuelRounds query against a seeded events pool.
 */

// Letter-encode years so event texts stay digit-free — the selection layer
// filters out events whose text contains their own year.
const DIGIT_LETTERS = "ABCDEFGHIJ";

function yearTag(year: number): string {
  return String(Math.abs(year))
    .split("")
    .map((digit) => DIGIT_LETTERS[Number(digit)])
    .join("");
}

async function seedEvents(t: ReturnType<typeof convexTest>, years: number[]) {
  await t.run(async (ctx) => {
    for (const year of years) {
      await ctx.db.insert("events", {
        year,
        event: `Synthetic event ${yearTag(year)}`,
        updatedAt: Date.now(),
      });
    }
  });
}

function rangeYears(from: number, to: number, step = 1): number[] {
  const years: number[] = [];
  for (let year = from; year <= to; year += step) {
    years.push(year);
  }
  return years;
}

describe("duel/queries", () => {
  describe("getDuelRounds", () => {
    it("returns the requested number of rounds with years included", async () => {
      const t = convexTest(schema, modules);
      await seedEvents(t, rangeYears(1000, 2000, 10));

      const result = await t.query(duelQueries.getDuelRounds, {
        seed: 12345,
        count: 5,
      });

      expect(result.rounds).toHaveLength(5);
      // poolSize is the sampled candidate count (bounded year-window reads),
      // not the full table size.
      expect(result.poolSize).toBeGreaterThan(0);
      expect(result.poolSize).toBeLessThanOrEqual(101);

      for (const round of result.rounds) {
        expect(typeof round.first.year).toBe("number");
        expect(typeof round.second.year).toBe("number");
        expect(round.first.text).toBeTruthy();
        expect(round.second.text).toBeTruthy();
        expect(round.first.year).not.toBe(round.second.year);
        expect(round.gap).toBe(Math.abs(round.first.year - round.second.year));
      }
    });

    it("is deterministic per seed and varies across seeds", async () => {
      const t = convexTest(schema, modules);
      await seedEvents(t, rangeYears(0, 2000, 5));

      const a1 = await t.query(duelQueries.getDuelRounds, { seed: 7, count: 8 });
      const a2 = await t.query(duelQueries.getDuelRounds, { seed: 7, count: 8 });
      const b = await t.query(duelQueries.getDuelRounds, { seed: 8, count: 8 });

      expect(a1.rounds).toEqual(a2.rounds);
      expect(a1.rounds).not.toEqual(b.rounds);
    });

    it("continues difficulty from startRound and excludes prior events", async () => {
      const t = convexTest(schema, modules);
      await seedEvents(t, rangeYears(1500, 2000, 1));

      const batch1 = await t.query(duelQueries.getDuelRounds, {
        seed: 42,
        count: 5,
        startRound: 0,
      });
      const usedIds = batch1.rounds.flatMap(
        (round: { first: { id: string }; second: { id: string } }) => [
          round.first.id,
          round.second.id,
        ],
      );

      const batch2 = await t.query(duelQueries.getDuelRounds, {
        seed: 43,
        count: 5,
        startRound: 5,
        excludeIds: usedIds,
      });

      expect(batch2.rounds.length).toBeGreaterThan(0);
      expect(batch2.rounds[0].roundIndex).toBe(5);
      for (const round of batch2.rounds) {
        expect(usedIds).not.toContain(round.first.id);
        expect(usedIds).not.toContain(round.second.id);
      }
    });

    it("clamps oversized requests instead of failing", async () => {
      const t = convexTest(schema, modules);
      await seedEvents(t, rangeYears(0, 2000, 2));

      const result = await t.query(duelQueries.getDuelRounds, {
        seed: 1,
        count: 500,
      });

      expect(result.rounds.length).toBeLessThanOrEqual(30);
      expect(result.rounds.length).toBeGreaterThan(0);
    });

    it("returns an empty batch when the pool is too small", async () => {
      const t = convexTest(schema, modules);
      await seedEvents(t, [1969]);

      const result = await t.query(duelQueries.getDuelRounds, {
        seed: 1,
        count: 5,
      });

      expect(result.rounds).toEqual([]);
      expect(result.poolSize).toBe(1);
    });
  });
});
