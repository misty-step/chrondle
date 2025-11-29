import { describe, it, expect } from "vitest";
import { generateOrderShareText, type OrderSharePayload } from "../shareCard";

describe("generateOrderShareText", () => {
  describe("NYT-style header", () => {
    it("shows score: Chrondle Order #347 6/6", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("Chrondle Order #347 6/6");
    });

    it("shows partial score: Chrondle Order #347 4/6", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("Chrondle Order #347 4/6");
    });
  });

  describe("results line", () => {
    it("converts correct results to ✓", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("✓ ✓ ✓ ✓ ✓ ✓");
    });

    it("converts incorrect results to ✗", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "incorrect"],
        score: { correctPairs: 0, totalPairs: 6, hintsUsed: 3, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("✗ ✗ ✗ ✗ ✗ ✗");
    });

    it("mixes ✓ and ✗ for mixed results", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("✓ ✗ ✓ ✓ ✗ ✓");
    });
  });

  describe("hints visualization bar (max 3)", () => {
    it("shows ⬜⬜⬜ for 0 hints used", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("⬜⬜⬜");
    });

    it("shows 💡💡⬜ for 2 hints used", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("💡💡⬜");
    });

    it("shows 💡💡💡 for all 3 hints used", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "correct"],
        score: { correctPairs: 1, totalPairs: 6, hintsUsed: 3, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("💡💡💡");
    });
  });

  describe("URL footer", () => {
    it("uses chrondle.app without protocol when no URL provided", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("chrondle.app");
      expect(result).not.toContain("https://");
    });

    it("strips protocol from provided URL", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
        url: "https://www.chrondle.app",
      };
      const result = generateOrderShareText(payload);

      expect(result).toContain("chrondle.app");
      expect(result).not.toContain("https://");
      expect(result).not.toContain("www.");
    });
  });

  describe("removed old kitschy elements", () => {
    it("does NOT include date", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("—");
      expect(result).not.toContain("Nov");
      expect(result).not.toContain("2025");
    });

    it("does NOT include Sequence Analysis subheader", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("📜");
      expect(result).not.toContain("Sequence Analysis");
    });

    it("does NOT include Status tier", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("Status:");
      expect(result).not.toContain("ARCHIVIST");
    });

    it("does NOT include Examined clues text", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("Examined:");
      expect(result).not.toContain("clues");
    });

    it("does NOT include accuracy percentage", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      expect(result).not.toContain("Accuracy:");
      expect(result).not.toContain("%");
    });
  });

  describe("character limits", () => {
    it("keeps share text under 280 characters for all scenarios", () => {
      const testCases: OrderSharePayload[] = [
        // Perfect score
        {
          dateLabel: "Nov 28",
          puzzleNumber: 347,
          results: ["correct", "correct", "correct", "correct", "correct", "correct"],
          score: {
            correctPairs: 6,
            totalPairs: 6,
            hintsUsed: 0,
            totalScore: 0,
          },
        },
        // High accuracy
        {
          dateLabel: "Nov 28",
          puzzleNumber: 347,
          results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
          score: {
            correctPairs: 4,
            totalPairs: 6,
            hintsUsed: 2,
            totalScore: 0,
          },
        },
        // Low accuracy
        {
          dateLabel: "Nov 28",
          puzzleNumber: 347,
          results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "correct"],
          score: {
            correctPairs: 1,
            totalPairs: 6,
            hintsUsed: 3,
            totalScore: 0,
          },
        },
      ];

      testCases.forEach((payload) => {
        const result = generateOrderShareText(payload);
        expect(result.length).toBeLessThanOrEqual(280);
      });
    });
  });

  describe("full share text examples", () => {
    it("generates correct text for perfect score (6/6)", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "correct", "correct", "correct", "correct", "correct"],
        score: { correctPairs: 6, totalPairs: 6, hintsUsed: 0, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #347 6/6

✓ ✓ ✓ ✓ ✓ ✓
⬜⬜⬜

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for partial score (4/6)", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["correct", "incorrect", "correct", "correct", "incorrect", "correct"],
        score: { correctPairs: 4, totalPairs: 6, hintsUsed: 2, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #347 4/6

✓ ✗ ✓ ✓ ✗ ✓
💡💡⬜

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for low score (1/6)", () => {
      const payload: OrderSharePayload = {
        dateLabel: "Nov 28",
        puzzleNumber: 347,
        results: ["incorrect", "incorrect", "incorrect", "incorrect", "incorrect", "correct"],
        score: { correctPairs: 1, totalPairs: 6, hintsUsed: 3, totalScore: 0 },
      };
      const result = generateOrderShareText(payload);

      const expected = `Chrondle Order #347 1/6

✗ ✗ ✗ ✗ ✗ ✓
💡💡💡

chrondle.app`;

      expect(result).toBe(expected);
    });
  });
});
