import { describe, it, expect } from "vitest";
import { generateOrderShareText } from "./shareCard";

describe("generateOrderShareText", () => {
  it("generates correct text", () => {
    const text = generateOrderShareText({
      dateLabel: "Nov 13",
      puzzleNumber: 123,
      results: ["correct", "incorrect", "correct", "correct", "correct", "incorrect"],
      score: { correctPairs: 4, totalPairs: 6, hintsUsed: 1, totalScore: 67, perfectPositions: 0 },
    });
    expect(text).toContain("Chrondle Order #123");
    expect(text).toContain("4/6 pairs · 1 hint");
    expect(text).toContain("🟩🟥🟩🟩🟩🟥");
    expect(text).toContain("chrondle.app");
  });
});
