import { describe, expect, it } from "vitest";
import { calculateOrderScore } from "@/lib/order/scoring";
import type { OrderEvent } from "@/types/orderGameState";

const events: OrderEvent[] = [
  { id: "a", year: 1200, text: "Event A" },
  { id: "b", year: 1400, text: "Event B" },
  { id: "c", year: 1600, text: "Event C" },
  { id: "d", year: 1800, text: "Event D" },
];

describe("calculateOrderScore", () => {
  it("awards maximum score for perfect ordering", () => {
    const result = calculateOrderScore(["a", "b", "c", "d"], events, 0);
    expect(result.correctPairs).toBe(6);
    expect(result.totalScore).toBe(12); // 6 pairs × 2 points
  });

  it("awards zero for reversed ordering", () => {
    const result = calculateOrderScore(["d", "c", "b", "a"], events, 0);
    expect(result.correctPairs).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it("tracks hints used", () => {
    const partial = calculateOrderScore(["a", "c", "b", "d"], events, 2);
    expect(partial.hintsUsed).toBe(2);
    expect(partial.totalScore).toBe(partial.correctPairs * 2);
  });

  it("falls back to event order when ordering is empty", () => {
    const result = calculateOrderScore([], events, 0);
    // Empty ordering defaults to events in their original order [a, b, c, d]
    // which is perfect, so all pairs correct
    expect(result.correctPairs).toBe(6);
    expect(result.totalPairs).toBe(6);
  });

  it("counts perfect positions correctly", () => {
    // Only 'a' and 'd' are in correct position
    const result = calculateOrderScore(["a", "c", "b", "d"], events, 0);
    expect(result.perfectPositions).toBe(2);
  });

  it("counts all positions correct for perfect ordering", () => {
    const result = calculateOrderScore(["a", "b", "c", "d"], events, 0);
    expect(result.perfectPositions).toBe(4);
  });
});
