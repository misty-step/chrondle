import { describe, it, expect } from "vitest";
import { generateShareText } from "../generator";
import type { RangeGuess } from "@/types/range";

describe("generateShareText", () => {
  describe("NYT-style header", () => {
    it("shows score for wins: Chrondle #347 85/100", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1964, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 85, true, 347);

      expect(result).toContain("Chrondle #347 85/100");
    });

    it("shows ✗ for losses: Chrondle #347 ✗", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 6, score: 0, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 0, false, 347);

      expect(result).toContain("Chrondle #347 ✗");
    });

    it("omits puzzle number when not provided", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true);

      expect(result).toContain("Chrondle 80/100");
      expect(result).not.toContain("#");
    });
  });

  describe("hints visualization bar", () => {
    it("shows 💡💡⬜⬜⬜⬜ for 2 hints used", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true);

      expect(result).toContain("💡💡⬜⬜⬜⬜");
    });

    it("shows ⬜⬜⬜⬜⬜⬜ for 0 hints used", () => {
      const ranges: RangeGuess[] = [
        { start: 1960, end: 1960, hintsUsed: 0, score: 100, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 100, true);

      expect(result).toContain("⬜⬜⬜⬜⬜⬜");
    });

    it("shows 💡💡💡💡💡💡 for all 6 hints used", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 6, score: 0, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 0, false);

      expect(result).toContain("💡💡💡💡💡💡");
    });
  });

  describe("result line", () => {
    it("shows 🎯 X-year window for wins", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1964, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true);

      expect(result).toContain("🎯 15-year window");
    });

    it("shows 📏 X-year window (missed) for losses", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1974, hintsUsed: 6, score: 0, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 0, false);

      expect(result).toContain("📏 25-year window (missed)");
    });

    it("shows 1-year window for exact match", () => {
      const ranges: RangeGuess[] = [
        { start: 1960, end: 1960, hintsUsed: 0, score: 100, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 100, true);

      expect(result).toContain("🎯 1-year window");
    });
  });

  describe("URL footer", () => {
    it("includes chrondle.app without protocol", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true);

      expect(result).toContain("chrondle.app");
      expect(result).not.toContain("https://");
      expect(result).not.toContain("http://");
    });
  });

  describe("removed old kitschy elements", () => {
    it("does NOT include date", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true, 347);

      expect(result).not.toContain("—");
      expect(result).not.toContain("Nov");
      expect(result).not.toContain("2025");
    });

    it("does NOT include Research Notes subheader", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true);

      expect(result).not.toContain("📜");
      expect(result).not.toContain("Research Notes");
    });

    it("does NOT include Status tier", () => {
      const ranges: RangeGuess[] = [
        { start: 1960, end: 1960, hintsUsed: 0, score: 100, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 100, true);

      expect(result).not.toContain("Status:");
      expect(result).not.toContain("ARCHIVIST");
      expect(result).not.toContain("RESEARCHER");
    });

    it("does NOT include Examined clues text", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1960, hintsUsed: 3, score: 60, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 60, true);

      expect(result).not.toContain("Examined:");
      expect(result).not.toContain("clues");
    });
  });

  describe("character limits", () => {
    it("keeps share text under 280 characters for all scenarios", () => {
      const testCases: Array<[RangeGuess[], number, boolean]> = [
        // Perfect win
        [[{ start: 1960, end: 1960, hintsUsed: 0, score: 100, timestamp: Date.now() }], 100, true],
        // Normal win
        [[{ start: 1950, end: 1964, hintsUsed: 2, score: 80, timestamp: Date.now() }], 80, true],
        // Wide range win
        [[{ start: 1900, end: 1999, hintsUsed: 6, score: 20, timestamp: Date.now() }], 20, true],
        // Loss
        [[{ start: 1950, end: 1960, hintsUsed: 6, score: 0, timestamp: Date.now() }], 0, false],
      ];

      testCases.forEach(([ranges, score, hasWon]) => {
        const result = generateShareText(ranges, score, hasWon, 347);
        expect(result.length).toBeLessThanOrEqual(280);
      });
    });
  });

  describe("full share text examples", () => {
    it("generates correct text for perfect win (100/100)", () => {
      const ranges: RangeGuess[] = [
        { start: 1960, end: 1960, hintsUsed: 0, score: 100, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 100, true, 347);

      const expected = `Chrondle #347 100/100

⬜⬜⬜⬜⬜⬜
🎯 1-year window

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for win with hints", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1964, hintsUsed: 2, score: 80, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 80, true, 96);

      const expected = `Chrondle #96 80/100

💡💡⬜⬜⬜⬜
🎯 15-year window

chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for loss", () => {
      const ranges: RangeGuess[] = [
        { start: 1950, end: 1974, hintsUsed: 6, score: 0, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 0, false, 96);

      const expected = `Chrondle #96 ✗

💡💡💡💡💡💡
📏 25-year window (missed)

chrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("error handling", () => {
    it("returns fallback text for invalid ranges", () => {
      const result = generateShareText([] as RangeGuess[], 80, true);

      expect(result).toBe("Chrondle share text generation failed");
    });

    it("returns fallback text for ranges with invalid structure", () => {
      const ranges = [{ start: "invalid" }] as unknown as RangeGuess[];
      const result = generateShareText(ranges, 80, true);

      expect(result).toBe("Chrondle share text generation failed");
    });

    it("returns fallback text on exception", () => {
      // Create a mock that throws
      const mockRanges = new Proxy([], {
        get() {
          throw new Error("Test error");
        },
      });

      const result = generateShareText(mockRanges as RangeGuess[], 80, true);

      expect(result).toBe("Chrondle: Game complete\nchrondle.app");
    });
  });

  describe("edge cases", () => {
    it("uses last range when multiple ranges provided", () => {
      const ranges: RangeGuess[] = [
        { start: 1900, end: 2000, hintsUsed: 1, score: 10, timestamp: Date.now() },
        { start: 1940, end: 1980, hintsUsed: 3, score: 30, timestamp: Date.now() },
        { start: 1950, end: 1964, hintsUsed: 5, score: 50, timestamp: Date.now() },
      ];
      const result = generateShareText(ranges, 50, true);

      // Should use hintsUsed from last range (5)
      expect(result).toContain("💡💡💡💡💡⬜");
      // Should use width from last range (15 years)
      expect(result).toContain("🎯 15-year window");
    });
  });
});
