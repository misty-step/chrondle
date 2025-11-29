import { describe, expect, it } from "vitest";
import { generateOrderShareText } from "../shareCard";

describe("generateOrderShareText - division guard", () => {
  it("handles totalPairs = 0 without error (edge case)", () => {
    const edgeCasePayload = {
      dateLabel: "28 Nov 2025",
      puzzleNumber: 247,
      results: [] as Array<"correct" | "incorrect">,
      score: {
        totalScore: 0,
        correctPairs: 0,
        totalPairs: 0, // Edge case: would cause division by zero
        hintsUsed: 0,
      },
    };

    expect(() => generateOrderShareText(edgeCasePayload)).not.toThrow();

    const shareText = generateOrderShareText(edgeCasePayload);
    expect(shareText).toContain("0% Accuracy"); // Should show 0%, not NaN%
  });

  it("generates correct share text for normal case", () => {
    const normalPayload = {
      dateLabel: "28 Nov 2025",
      puzzleNumber: 247,
      results: ["correct", "correct", "incorrect"] as Array<"correct" | "incorrect">,
      score: {
        totalScore: 85,
        correctPairs: 12,
        totalPairs: 15,
        hintsUsed: 1,
      },
      url: "https://chrondle.app",
    };

    const shareText = generateOrderShareText(normalPayload);

    expect(shareText).toContain("CHRONDLE ORDER #247 · 28 Nov 2025");
    expect(shareText).toContain("✓ ✓ ✗"); // Emoji line
    expect(shareText).toContain("80% Accuracy"); // 12/15 = 80%
    expect(shareText).toContain("12/15 pairs");
    expect(shareText).toContain("💡 1/3 hints");
    expect(shareText).toContain("https://chrondle.app");
  });

  it("generates correct share text with perfect accuracy", () => {
    const perfectPayload = {
      dateLabel: "28 Nov 2025",
      puzzleNumber: 247,
      results: ["correct", "correct", "correct"] as Array<"correct" | "incorrect">,
      score: {
        totalScore: 100,
        correctPairs: 15,
        totalPairs: 15,
        hintsUsed: 0,
      },
    };

    const shareText = generateOrderShareText(perfectPayload);

    expect(shareText).toContain("100% Accuracy");
    expect(shareText).toContain("15/15 pairs");
    expect(shareText).toContain("💡 0/3 hints");
  });

  it("uses default URL when not provided", () => {
    const payloadWithoutUrl = {
      dateLabel: "28 Nov 2025",
      puzzleNumber: 247,
      results: ["correct"] as Array<"correct" | "incorrect">,
      score: {
        totalScore: 50,
        correctPairs: 1,
        totalPairs: 1,
        hintsUsed: 2,
      },
    };

    const shareText = generateOrderShareText(payloadWithoutUrl);

    expect(shareText).toContain("https://www.chrondle.app");
  });
});
