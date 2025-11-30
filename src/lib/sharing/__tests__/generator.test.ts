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
  const createRange = (start: number, end: number): RangeGuess => ({
    start,
    end,
    hintsUsed: 0,
    score: 0,
    timestamp: Date.now(),
  });

  describe("Header", () => {
    it("shows attempt count for wins: Chrondle #347 1/6", () => {
      const ranges = [createRange(1950, 1950)]; // Exact hit
      const result = generateShareText(ranges, 100, true, 347, { targetYear: 1950 });
      expect(result).toContain("Chrondle #347 1/6");
    });

    it("shows X/6 for losses: Chrondle #347 X/6", () => {
      const ranges = [createRange(1000, 1100)]; // Miss
      const result = generateShareText(ranges, 0, false, 347, { targetYear: 1950 });
      expect(result).toContain("Chrondle #347 X/6");
    });

    it("omits puzzle number when not provided: Chrondle 1/6", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateShareText(ranges, 100, true, undefined, { targetYear: 1950 });
      expect(result).toContain("Chrondle 1/6");
      expect(result).not.toContain("#");
    });
  });

  describe("Proximity Grid", () => {
    const targetYear = 2000;

    it("shows 5 Green squares for a Hit (Contained)", () => {
      const ranges = [createRange(1990, 2010)]; // Contains 2000
      const result = generateShareText(ranges, 100, true, undefined, { targetYear });
      expect(result).toContain("🟩🟩🟩🟩🟩");
    });

    it("shows 4 Yellow squares for Very Close (<= 25 years)", () => {
      // Target 2000. Range 1950-1975 (End is 1975, Dist 25)
      const ranges = [createRange(1950, 1975)];
      const result = generateShareText(ranges, 0, false, undefined, { targetYear });
      expect(result).toContain("🟨🟨🟨🟨⬜");
    });

    it("shows 3 Yellow squares for Close (<= 100 years)", () => {
      // Target 2000. Range 1900-1900 (Dist 100)
      const ranges = [createRange(1900, 1900)];
      const result = generateShareText(ranges, 0, false, undefined, { targetYear });
      expect(result).toContain("🟨🟨🟨⬜⬜");
    });

    it("shows 2 Red squares for Far (<= 500 years)", () => {
      // Target 2000. Range 1500-1500 (Dist 500)
      const ranges = [createRange(1500, 1500)];
      const result = generateShareText(ranges, 0, false, undefined, { targetYear });
      expect(result).toContain("🟥🟥⬜⬜⬜");
    });

    it("shows 1 Red square for Very Far (> 500 years)", () => {
      // Target 2000. Range 1000-1000 (Dist 1000)
      const ranges = [createRange(1000, 1000)];
      const result = generateShareText(ranges, 0, false, undefined, { targetYear });
      expect(result).toContain("🟥⬜⬜⬜⬜");
    });

    it("generates multiple rows for multiple guesses", () => {
      const ranges = [
        createRange(1000, 1000), // Very Far
        createRange(1900, 1900), // Close
        createRange(1990, 2010), // Hit
      ];
      const result = generateShareText(ranges, 100, true, undefined, { targetYear });
      const lines = result.split("\n").filter((line) => line.includes("⬜") || line.includes("🟩"));

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("🟥⬜⬜⬜⬜");
      expect(lines[1]).toBe("🟨🟨🟨⬜⬜");
      expect(lines[2]).toBe("🟩🟩🟩🟩🟩");
    });
  });

  describe("Footer", () => {
    it("includes chrondle.app", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateShareText(ranges, 100, true, undefined, { targetYear: 1950 });
      expect(result).toContain("chrondle.app");
    });
  });

  describe("Error Handling", () => {
    it("returns fallback text for invalid ranges", () => {
      const result = generateShareText(null as unknown as RangeGuess[], 80, true);
      expect(result).toBe("Chrondle share text generation failed");
    });

    it("returns fallback text for ranges with invalid structure", () => {
      const result = generateShareText([{ foo: "bar" } as unknown as RangeGuess], 80, true);
      expect(result).toBe("Chrondle share text generation failed");
    });

    it("returns fallback text on exception", () => {
      // Mock logger.error to throw (simulating unexpected error)
      const explodingRanges = new Proxy([], {
        get() {
          throw new Error("Test error");
        },
      });

      const result = generateShareText(explodingRanges as unknown as RangeGuess[], 80, true);
      expect(result).toContain("Chrondle: Game complete");
    });

    it("handles missing targetYear gracefully (fallback grid)", () => {
      const ranges = [createRange(1950, 1950)];
      // No targetYear provided
      const result = generateShareText(ranges, 100, true);
      // Should default to just showing green for win
      expect(result).toContain("🟩🟩🟩🟩🟩");
    });
  });
});
