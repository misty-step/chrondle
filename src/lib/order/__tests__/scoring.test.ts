import { describe, expect, it } from "vitest";
import { scoreOrderSubmission } from "@/lib/order/scoring";
import type { OrderEvent } from "@/types/orderGameState";

const events: OrderEvent[] = [
  { id: "a", year: 1200, text: "Event A" },
  { id: "b", year: 1400, text: "Event B" },
  { id: "c", year: 1600, text: "Event C" },
  { id: "d", year: 1800, text: "Event D" },
];

describe("scoreOrderSubmission", () => {
  it("awards maximum score for perfect ordering", () => {
    const result = scoreOrderSubmission(["a", "b", "c", "d"], events, 0);
    expect(result.correctPairs).toBe(6);
    expect(result.totalScore).toBe(12); // 6 pairs × 2 points
  });

  it("awards zero for reversed ordering", () => {
    const result = scoreOrderSubmission(["d", "c", "b", "a"], events, 0);
    expect(result.correctPairs).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  it("tracks hints used", () => {
    const partial = scoreOrderSubmission(["a", "c", "b", "d"], events, 2);
    expect(partial.hintsUsed).toBe(2);
    expect(partial.totalScore).toBe(partial.correctPairs * 2);
  });
});
