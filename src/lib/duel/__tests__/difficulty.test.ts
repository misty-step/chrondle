import { describe, it, expect } from "vitest";
import { DUEL_TIERS, tierForRound } from "../difficulty";

describe("DUEL_TIERS", () => {
  it("starts at round 0", () => {
    expect(DUEL_TIERS[0].startRound).toBe(0);
  });

  it("is ordered by ascending startRound", () => {
    for (let i = 1; i < DUEL_TIERS.length; i++) {
      expect(DUEL_TIERS[i].startRound).toBeGreaterThan(DUEL_TIERS[i - 1].startRound);
    }
  });

  it("narrows monotonically: each tier's gap window sits below the previous", () => {
    for (let i = 1; i < DUEL_TIERS.length; i++) {
      expect(DUEL_TIERS[i].maxGap).toBeLessThanOrEqual(DUEL_TIERS[i - 1].maxGap);
      expect(DUEL_TIERS[i].minGap).toBeLessThanOrEqual(DUEL_TIERS[i - 1].minGap);
    }
  });

  it("keeps every window valid (1 <= minGap <= maxGap)", () => {
    for (const tier of DUEL_TIERS) {
      expect(tier.minGap).toBeGreaterThanOrEqual(1);
      expect(tier.maxGap).toBeGreaterThanOrEqual(tier.minGap);
    }
  });
});

describe("tierForRound", () => {
  it("returns the first tier for round 0", () => {
    expect(tierForRound(0)).toBe(DUEL_TIERS[0]);
  });

  it("returns the matching tier at each boundary", () => {
    for (const tier of DUEL_TIERS) {
      expect(tierForRound(tier.startRound)).toBe(tier);
      if (tier.startRound > 0) {
        const previous = tierForRound(tier.startRound - 1);
        expect(previous).not.toBe(tier);
      }
    }
  });

  it("stays in the final tier for arbitrarily deep runs", () => {
    const last = DUEL_TIERS[DUEL_TIERS.length - 1];
    expect(tierForRound(last.startRound)).toBe(last);
    expect(tierForRound(500)).toBe(last);
    expect(tierForRound(10_000)).toBe(last);
  });

  it("clamps negative and non-finite input to round 0", () => {
    expect(tierForRound(-5)).toBe(DUEL_TIERS[0]);
    expect(tierForRound(Number.NaN)).toBe(DUEL_TIERS[0]);
    expect(tierForRound(Number.POSITIVE_INFINITY)).toBe(DUEL_TIERS[0]);
  });
});
