import { describe, expect, it } from "vitest";
import { getAccuracyPercent } from "../attemptScoring";
import type { OrderAttempt } from "@/types/orderGameState";

describe("getAccuracyPercent - division guard", () => {
  it("returns 0 when totalPairs is 0 (edge case)", () => {
    const edgeCaseAttempt: OrderAttempt = {
      ordering: [],
      feedback: [],
      pairsCorrect: 0,
      totalPairs: 0, // Edge case: would cause division by zero
      timestamp: Date.now(),
    };

    expect(getAccuracyPercent(edgeCaseAttempt)).toBe(0);
  });

  it("handles normal cases correctly", () => {
    const normalAttempt: OrderAttempt = {
      ordering: ["a", "b", "c"],
      feedback: ["correct", "correct", "incorrect"],
      pairsCorrect: 2,
      totalPairs: 3, // C(3,2) = 3 pairs
      timestamp: Date.now(),
    };

    expect(getAccuracyPercent(normalAttempt)).toBe(67); // 2/3 * 100 = 66.67 → 67
  });

  it("returns 100 for perfect accuracy", () => {
    const perfectAttempt: OrderAttempt = {
      ordering: ["a", "b", "c", "d"],
      feedback: ["correct", "correct", "correct", "correct"],
      pairsCorrect: 6,
      totalPairs: 6, // C(4,2) = 6 pairs
      timestamp: Date.now(),
    };

    expect(getAccuracyPercent(perfectAttempt)).toBe(100);
  });

  it("returns 0 for zero correct pairs", () => {
    const zeroAccuracy: OrderAttempt = {
      ordering: ["d", "c", "b", "a"],
      feedback: ["incorrect", "incorrect", "incorrect", "incorrect"],
      pairsCorrect: 0,
      totalPairs: 6,
      timestamp: Date.now(),
    };

    expect(getAccuracyPercent(zeroAccuracy)).toBe(0);
  });

  it("rounds correctly for fractional percentages", () => {
    const fractional: OrderAttempt = {
      ordering: ["a", "b", "c", "d", "e", "f"],
      feedback: ["correct", "correct", "correct", "incorrect", "incorrect", "incorrect"],
      pairsCorrect: 12,
      totalPairs: 15, // C(6,2) = 15 pairs
      timestamp: Date.now(),
    };

    expect(getAccuracyPercent(fractional)).toBe(80); // 12/15 * 100 = 80
  });
});
