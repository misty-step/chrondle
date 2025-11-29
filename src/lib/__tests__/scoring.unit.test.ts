import { describe, expect, it } from "vitest";

import { SCORING_CONSTANTS, scoreRange, scoreRangeDetailed } from "../scoring";

describe("scoreRange", () => {
  it("awards the maximum score for a perfect one-year range", () => {
    // New system: 100 points for 1-year range, 0 hints
    expect(scoreRange(1969, 1969, 1969)).toBe(100);
  });

  it("applies the correct hint deduction (2 hints → 70pts max)", () => {
    // New system: 70 points max for 1-year range, 2 hints revealed
    expect(scoreRange(1969, 1969, 1969, 0, 2)).toBe(70);
  });

  it("supports the sixth hint without breaking the cap", () => {
    expect(scoreRange(1776, 1776, 1776, 0, 6)).toBe(25);
  });

  it("returns zero when the answer falls outside the range", () => {
    expect(scoreRange(1900, 1950, 1969)).toBe(0);
  });

  it("extends containment using tolerance for fuzzy events", () => {
    const withinTolerance = scoreRange(1900, 1910, 1912, 2);
    expect(withinTolerance).toBeGreaterThan(0);
  });

  it("supports BC years naturally", () => {
    const bcScore = scoreRange(-120, -80, -90);
    expect(bcScore).toBeGreaterThan(0);
  });

  it("throws when range width exceeds the maximum", () => {
    expect(() => scoreRange(0, 500, 42)).toThrow(/range width/i);
  });

  it("throws when start is after end", () => {
    expect(() => scoreRange(2000, 1990, 1995)).toThrow(/start year/i);
  });

  it("rejects non-finite input", () => {
    expect(() => scoreRange(Number.NaN, 1900, 1900)).toThrow(/start must be a finite number/);
  });

  it("ensures narrower ranges never score less than wider ones", () => {
    const answer = 1950;
    const scores: number[] = [];

    for (let width = 1; width <= 10; width += 1) {
      const start = answer - Math.floor(width / 2);
      const end = start + width - 1;
      scores.push(scoreRange(start, end, answer));
    }

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it("rejects hint levels above six", () => {
    expect(() => scoreRange(1950, 1950, 1950, 0, 7 as never)).toThrow(/between 0 and 6 inclusive/i);
  });

  it("ensures a minimum score floor for maximum width ranges (0 hints)", () => {
    // Width W_MAX, 0 hints.
    // Old logic: 0 pts. New logic (5% floor): MIN_WIDTH_FACTOR_FLOOR * MAX_SCORES_BY_HINTS[0]
    const start = 1000;
    const width = SCORING_CONSTANTS.W_MAX;
    const end = start + width - 1; // Width 250
    const answer = 1100;
    const hintsUsed = 0;

    const score = scoreRange(start, end, answer, 0, hintsUsed);
    const expectedScore = Math.floor(
      SCORING_CONSTANTS.MIN_WIDTH_FACTOR_FLOOR * SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[hintsUsed],
    );

    expect(score).toBe(expectedScore); // 5 pts = Math.floor(0.05 * 100)
  });

  it("ensures a minimum score floor for maximum width ranges (6 hints)", () => {
    // Width W_MAX, 6 hints.
    // Old logic: 0 pts. New logic (5% floor): MIN_WIDTH_FACTOR_FLOOR * MAX_SCORES_BY_HINTS[6]
    const start = 1000;
    const width = SCORING_CONSTANTS.W_MAX;
    const end = start + width - 1; // Width 250
    const answer = 1100;
    const hintsUsed = 6;

    const score = scoreRange(start, end, answer, 0, hintsUsed);
    const expectedScore = Math.floor(
      SCORING_CONSTANTS.MIN_WIDTH_FACTOR_FLOOR * SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[hintsUsed],
    );

    expect(score).toBe(expectedScore); // 1 pt = Math.floor(0.05 * 25)
  });
});

describe("scoreRangeDetailed", () => {
  it("exposes metadata useful for debugging and UI", () => {
    const result = scoreRangeDetailed(1969, 1969, 1969);

    expect(result).toMatchObject({
      contained: true,
      width: 1,
      score: 100, // New system: 100 points for 1-year range, 0 hints
    });

    // baseScore should equal the unrounded score value
    const maxScore = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[0]; // 100
    const widthFactor = (SCORING_CONSTANTS.W_MAX - result.width + 1) / SCORING_CONSTANTS.W_MAX; // 250/250 = 1.0
    const expectedBase = maxScore * widthFactor; // 100 * 1.0 = 100

    expect(result.baseScore).toBeCloseTo(expectedBase, 6);
  });

  it("returns zeros when the range misses the answer", () => {
    expect(scoreRangeDetailed(1500, 1600, 1700)).toEqual({
      baseScore: 0,
      contained: false,
      score: 0,
      width: 101,
    });
  });
});
