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
    // NYT-style format: header shows 0/0
    expect(shareText).toContain("Chrondle Order #247 0/0");
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

    // NYT-style format
    expect(shareText).toContain("Chrondle Order #247 12/15");
    expect(shareText).toContain("✓ ✓ ✗"); // Results line
    expect(shareText).toContain("💡⬜⬜"); // 1 hint used
    expect(shareText).toContain("chrondle.app"); // URL without protocol
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

    expect(shareText).toContain("Chrondle Order #247 15/15");
    expect(shareText).toContain("✓ ✓ ✓");
    expect(shareText).toContain("⬜⬜⬜"); // 0 hints used
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

    // NYT-style uses clean URL without protocol
    expect(shareText).toContain("chrondle.app");
  });
});
