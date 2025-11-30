import { describe, it, expect, vi } from "vitest";
import { generateShareText } from "../generator";
import { RangeGuess } from "@/types/range";

// Mock logger to prevent console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("generateShareText", () => {
  // Helper to create a standard range guess
  const createRange = (start: number, end: number, hintsUsed = 0): RangeGuess => ({
    start,
    end,
    hintsUsed: hintsUsed as RangeGuess["hintsUsed"],
    score: 0,
    timestamp: Date.now(),
  });

  describe("Header", () => {
    it("shows standard header with puzzle number: Chrondle #347", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateShareText(ranges, 100, true, 347);
      expect(result).toContain("Chrondle #347");
    });

    it("omits puzzle number when not provided", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateShareText(ranges, 100, true);
      expect(result).toContain("Chrondle");
      expect(result).not.toContain("#");
    });
  });

  describe("Range Row", () => {
    it("shows range width with calendar emoji: Range: 🗓️ 15 years", () => {
      const ranges = [createRange(1900, 1914)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("Range: 🗓️ 15 years");
    });

    it("uses singular 'year' for width 1", () => {
      const ranges = [createRange(1900, 1900)];
      const result = generateShareText(ranges, 100, true, 347);
      expect(result).toContain("Range: 🗓️ 1 year");
    });
  });

  describe("Hints Row", () => {
    it("shows filled/empty squares: Hints: ⬛⬛⬜⬜⬜⬜", () => {
      const ranges = [createRange(1900, 1914, 2)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("Hints: ⬛⬛⬜⬜⬜⬜");
    });

    it("shows all empty for 0 hints", () => {
      const ranges = [createRange(1900, 1914, 0)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("Hints: ⬜⬜⬜⬜⬜⬜");
    });
  });

  describe("Score Row", () => {
    it("shows Bullseye for 100", () => {
      const result = generateShareText([createRange(1900, 1900)], 100, true, 347);
      expect(result).toContain("Score: 🎯 100/100");
    });

    it("shows Fire for 90-99", () => {
      const result = generateShareText([createRange(1900, 1900)], 95, true, 347);
      expect(result).toContain("Score: 🔥 95/100");
    });

    it("shows Star for 80-89", () => {
      const result = generateShareText([createRange(1900, 1900)], 85, true, 347);
      expect(result).toContain("Score: ⭐ 85/100");
    });

    it("shows Sunglasses for 70-79", () => {
      const result = generateShareText([createRange(1900, 1900)], 75, true, 347);
      expect(result).toContain("Score: 😎 75/100");
    });

    it("shows Thumbs Up for < 70 (Won)", () => {
      const result = generateShareText([createRange(1900, 1900)], 60, true, 347);
      expect(result).toContain("Score: 👍 60/100");
    });

    it("shows X for Loss", () => {
      const result = generateShareText([createRange(1900, 1900)], 40, false, 347);
      expect(result).toContain("Score: ❌ 40/100");
    });
  });

  describe("Full Examples", () => {
    it("generates correct text for perfect win", () => {
      const ranges = [createRange(1950, 1950, 0)];
      const result = generateShareText(ranges, 100, true, 347);

      const expected = `Chrondle #347\nRange: 🗓️ 1 year\nHints: ⬜⬜⬜⬜⬜⬜\nScore: 🎯 100/100\n\nchrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("Error Handling", () => {
    it("returns fallback text for invalid ranges", () => {
      const result = generateShareText(null as unknown as RangeGuess[], 80, true);
      expect(result).toContain("Chrondle share text generation failed");
    });

    it("returns fallback text for empty ranges", () => {
      const result = generateShareText([], 0, false);
      expect(result).toContain("Chrondle share text generation failed");
    });
  });
});
