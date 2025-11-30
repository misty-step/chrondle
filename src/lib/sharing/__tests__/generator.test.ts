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

  describe("Score Line", () => {
    it("shows trophy and score for wins: 🏆 85/100", () => {
      const ranges = [createRange(1900, 1915)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("🏆 85/100");
    });

    it("shows X and score for losses: ❌ 40/100", () => {
      const ranges = [createRange(1900, 1950)];
      const result = generateShareText(ranges, 40, false, 347);
      expect(result).toContain("❌ 40/100");
    });
  });

  describe("Stats Line", () => {
    it("shows hints and range width: 💡 2 • 📏 15y", () => {
      // Range 1900-1914 = 15 years, 2 hints
      const ranges = [createRange(1900, 1914, 2)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("💡 2 • 📏 15y");
    });

    it("uses values from the last range", () => {
      const ranges = [
        createRange(1800, 1900, 0), // First guess
        createRange(1900, 1900, 3), // Final guess: 1 year, 3 hints
      ];
      const result = generateShareText(ranges, 100, true, 347);
      expect(result).toContain("💡 3 • 📏 1y");
    });

    it("shows 0 hints correctly: 💡 0", () => {
      const ranges = [createRange(1900, 1900, 0)];
      const result = generateShareText(ranges, 100, true, 347);
      expect(result).toContain("💡 0");
    });
  });

  describe("Footer", () => {
    it("includes chrondle.app", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateShareText(ranges, 100, true);
      expect(result).toContain("chrondle.app");
    });
  });

  describe("Full Examples", () => {
    it("generates correct text for perfect win", () => {
      const ranges = [createRange(1950, 1950, 0)];
      const result = generateShareText(ranges, 100, true, 347);

      const expected = `Chrondle #347\n🏆 100/100\n💡 0 • 📏 1y\n\nchrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("Error Handling", () => {
    it("returns fallback text for invalid ranges", () => {
      const result = generateShareText(null as unknown as RangeGuess[], 80, true);
      expect(result).toBe("Chrondle share text generation failed");
    });

    it("returns fallback text for empty ranges", () => {
      const result = generateShareText([], 0, false);
      expect(result).toBe("Chrondle share text generation failed");
    });
  });
});
