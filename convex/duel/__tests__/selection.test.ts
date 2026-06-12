import { describe, it, expect } from "vitest";
import { selectDuelRounds, type DuelEventCandidate } from "../selection";
import { DUEL_TIERS, tierForRound } from "../../../src/lib/duel/difficulty";

/**
 * Build a synthetic pool: one event per year across an inclusive range.
 * Dense pools let us assert strict tier-gap compliance.
 *
 * Texts are digit-free (years letter-encoded) so the own-year leak filter
 * never trips on fixtures.
 */
const DIGIT_LETTERS = "ABCDEFGHIJ";

function yearTag(year: number): string {
  const encoded = String(Math.abs(year))
    .split("")
    .map((digit) => DIGIT_LETTERS[Number(digit)])
    .join("");
  return year < 0 ? `${encoded} BC` : encoded;
}

function densePool(fromYear: number, toYear: number, step = 1): DuelEventCandidate[] {
  const pool: DuelEventCandidate[] = [];
  for (let year = fromYear; year <= toYear; year += step) {
    pool.push({
      _id: `evt_${year}` as DuelEventCandidate["_id"],
      year,
      event: `Event ${yearTag(year)}`,
    });
  }
  return pool;
}

describe("selectDuelRounds", () => {
  it("is deterministic for identical inputs", () => {
    const pool = densePool(1000, 2000);
    const a = selectDuelRounds(pool, 12345, { count: 10 });
    const b = selectDuelRounds(pool, 12345, { count: 10 });
    expect(a).toEqual(b);
  });

  it("is insensitive to input ordering", () => {
    const pool = densePool(1000, 2000);
    const reversed = [...pool].reverse();
    const a = selectDuelRounds(pool, 777, { count: 8 });
    const b = selectDuelRounds(reversed, 777, { count: 8 });
    expect(a).toEqual(b);
  });

  it("produces different rounds for different seeds", () => {
    const pool = densePool(0, 2000);
    const a = selectDuelRounds(pool, 1, { count: 10 });
    const b = selectDuelRounds(pool, 2, { count: 10 });
    expect(a).not.toEqual(b);
  });

  it("respects tier gap windows when the pool supports them", () => {
    const pool = densePool(-1000, 2000);
    const rounds = selectDuelRounds(pool, 42, { count: 25 });

    expect(rounds).toHaveLength(25);
    for (const round of rounds) {
      const tier = tierForRound(round.roundIndex);
      expect(round.tierLabel).toBe(tier.label);
      expect(round.gap).toBeGreaterThanOrEqual(tier.minGap);
      expect(round.gap).toBeLessThanOrEqual(tier.maxGap);
    }
  });

  it("starts difficulty from startRound, not zero", () => {
    const pool = densePool(0, 2000);
    const lastTier = DUEL_TIERS[DUEL_TIERS.length - 1];
    const rounds = selectDuelRounds(pool, 9, {
      count: 5,
      startRound: lastTier.startRound,
    });

    expect(rounds).toHaveLength(5);
    for (const round of rounds) {
      expect(round.tierLabel).toBe(lastTier.label);
      expect(round.gap).toBeGreaterThanOrEqual(lastTier.minGap);
      expect(round.gap).toBeLessThanOrEqual(lastTier.maxGap);
    }
  });

  it("never repeats an event within a batch", () => {
    const pool = densePool(0, 2000);
    const rounds = selectDuelRounds(pool, 1234, { count: 20 });
    const ids = rounds.flatMap((round) => [round.first.id, round.second.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never selects excluded events", () => {
    const pool = densePool(1000, 1100);
    const excludeIds = pool.slice(0, 50).map((event) => event._id);
    const rounds = selectDuelRounds(pool, 5, { count: 5, excludeIds });

    for (const round of rounds) {
      expect(excludeIds).not.toContain(round.first.id);
      expect(excludeIds).not.toContain(round.second.id);
    }
  });

  it("pairs events with distinct years and reports the true gap", () => {
    const pool = densePool(-500, 1500);
    const rounds = selectDuelRounds(pool, 31337, { count: 15 });

    for (const round of rounds) {
      expect(round.first.year).not.toBe(round.second.year);
      expect(round.gap).toBe(Math.abs(round.first.year - round.second.year));
      expect(round.gap).toBeGreaterThanOrEqual(1);
    }
  });

  it("varies which slot holds the earlier event", () => {
    const pool = densePool(0, 3000);
    const rounds = selectDuelRounds(pool, 555, { count: 20 });

    const earlierFirst = rounds.filter((round) => round.first.year < round.second.year);
    expect(earlierFirst.length).toBeGreaterThan(0);
    expect(earlierFirst.length).toBeLessThan(rounds.length);
  });

  it("relaxes the gap window instead of dying on sparse pools", () => {
    // Pool only contains events 500 years apart; the Legend tier (gap 1-4)
    // can never be satisfied strictly.
    const sparse = densePool(0, 3000, 500);
    const lastTier = DUEL_TIERS[DUEL_TIERS.length - 1];
    const rounds = selectDuelRounds(sparse, 7, {
      count: 3,
      startRound: lastTier.startRound,
    });

    expect(rounds.length).toBe(3);
    for (const round of rounds) {
      expect(round.gap).toBeGreaterThanOrEqual(500);
    }
  });

  it("returns an empty batch when fewer than two events remain", () => {
    expect(selectDuelRounds([], 1, { count: 5 })).toEqual([]);
    expect(selectDuelRounds(densePool(1900, 1900), 1, { count: 5 })).toEqual([]);

    const pool = densePool(1900, 1950);
    const excludeIds = pool.map((event) => event._id);
    expect(selectDuelRounds(pool, 1, { count: 5, excludeIds })).toEqual([]);
  });

  it("returns fewer rounds when the pool runs dry mid-batch", () => {
    // 6 events => at most 3 rounds regardless of requested count.
    const pool = densePool(1000, 2000, 200);
    const rounds = selectDuelRounds(pool, 99, { count: 10 });
    expect(rounds.length).toBeLessThanOrEqual(3);
    expect(rounds.length).toBeGreaterThan(0);
  });

  it("handles BC/AD spanning pairs (negative internal years)", () => {
    const pool = densePool(-300, 300, 50);
    const rounds = selectDuelRounds(pool, 21, { count: 3 });

    expect(rounds.length).toBeGreaterThan(0);
    for (const round of rounds) {
      expect(round.gap).toBe(Math.abs(round.first.year - round.second.year));
    }
  });

  it("never selects events whose text contains their own year", () => {
    const pool = densePool(1400, 1600);
    const leaky: DuelEventCandidate = {
      _id: "evt_leak" as DuelEventCandidate["_id"],
      year: 1492,
      event: "In 1492 Columbus sailed the ocean blue",
    };
    const rounds = selectDuelRounds([...pool, leaky], 13, { count: 20 });

    for (const round of rounds) {
      expect(round.first.id).not.toBe("evt_leak");
      expect(round.second.id).not.toBe("evt_leak");
    }
  });

  it("keeps events with incidental small numbers", () => {
    const apollo: DuelEventCandidate = {
      _id: "evt_apollo" as DuelEventCandidate["_id"],
      year: 1969,
      event: "Apollo 11 lands on the Moon",
    };
    const other: DuelEventCandidate = {
      _id: "evt_other" as DuelEventCandidate["_id"],
      year: 1492,
      event: "Columbus reaches the Americas",
    };
    const rounds = selectDuelRounds([apollo, other], 3, { count: 1 });
    expect(rounds).toHaveLength(1);
  });

  it("rejects nonsensical counts gracefully", () => {
    const pool = densePool(1000, 1100);
    expect(selectDuelRounds(pool, 1, { count: 0 })).toEqual([]);
    expect(selectDuelRounds(pool, 1, { count: -3 })).toEqual([]);
    expect(selectDuelRounds(pool, 1, { count: Number.NaN })).toEqual([]);
  });
});
