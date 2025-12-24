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

  describe("Stats Line", () => {
    it("shows range width with calendar emoji: 🗓️ 15 years", () => {
      const ranges = [createRange(1900, 1914)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("🗓️ 15 years");
    });

    it("uses singular 'year' for width 1", () => {
      const ranges = [createRange(1900, 1900)];
      const result = generateShareText(ranges, 100, true, 347);
      expect(result).toContain("🗓️ 1 year");
    });

    it("shows range and score on separate lines", () => {
      const ranges = [createRange(1900, 1914)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("🗓️ 15 years\n⭐ 85/100");
    });
  });

  describe("Hints Bar", () => {
    it("shows green squares for hints used: 🟩🟩⬜⬜⬜⬜", () => {
      const ranges = [createRange(1900, 1914, 2)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("🟩🟩⬜⬜⬜⬜");
    });

    it("shows all empty for 0 hints", () => {
      const ranges = [createRange(1900, 1914, 0)];
      const result = generateShareText(ranges, 85, true, 347);
      expect(result).toContain("⬜⬜⬜⬜⬜⬜");
    });
  });

  describe("Score Emoji", () => {
    it("shows Bullseye for 100", () => {
      const result = generateShareText([createRange(1900, 1900)], 100, true, 347);
      expect(result).toContain("🎯 100/100");
    });

    it("shows Fire for 90-99", () => {
      const result = generateShareText([createRange(1900, 1900)], 95, true, 347);
      expect(result).toContain("🔥 95/100");
    });

    it("shows Star for 80-89", () => {
      const result = generateShareText([createRange(1900, 1900)], 85, true, 347);
      expect(result).toContain("⭐ 85/100");
    });

    it("shows Sunglasses for 70-79", () => {
      const result = generateShareText([createRange(1900, 1900)], 75, true, 347);
      expect(result).toContain("😎 75/100");
    });

    it("shows Thumbs Up for < 70 (Won)", () => {
      const result = generateShareText([createRange(1900, 1900)], 60, true, 347);
      expect(result).toContain("👍 60/100");
    });

    it("shows melting face for Loss", () => {
      const result = generateShareText([createRange(1900, 1900)], 40, false, 347);
      expect(result).toContain("🫠 40/100");
    });
  });

  describe("Loss with Proximity", () => {
    it("shows 'Xy early' for earlier miss", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateShareText(ranges, 0, false, 347, {
        missDistance: 5,
        missDirection: "earlier",
      });
      expect(result).toContain("🫠 5y early");
    });

    it("shows 'Xy late' for later miss", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateShareText(ranges, 0, false, 347, {
        missDistance: 3,
        missDirection: "later",
      });
      expect(result).toContain("🫠 3y late");
    });

    it("shows '0y early' for zero distance at start edge", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateShareText(ranges, 0, false, 347, {
        missDistance: 0,
        missDirection: "earlier",
      });
      expect(result).toContain("🫠 0y early");
    });

    it("falls back to score when missDistance not provided", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateShareText(ranges, 0, false, 347);
      expect(result).toContain("🫠 0/100");
    });

    it("falls back to score when missDirection is null", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateShareText(ranges, 0, false, 347, {
        missDistance: 5,
        missDirection: null,
      });
      expect(result).toContain("🫠 0/100");
    });

    it("keeps win format unchanged when hasWon is true", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateShareText(ranges, 75, true, 347, {
        missDistance: 5,
        missDirection: "earlier",
      });
      expect(result).toContain("😎 75/100");
      expect(result).not.toContain("5y early");
    });

    it("generates correct full text for loss with earlier miss", () => {
      const ranges = [createRange(1950, 1960, 3)];
      const result = generateShareText(ranges, 0, false, 123, {
        missDistance: 7,
        missDirection: "earlier",
      });

      const expected = `Chrondle #123

🟩🟩🟩⬜⬜⬜
🗓️ 11 years
🫠 7y early

https://chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct full text for loss with later miss", () => {
      const ranges = [createRange(1950, 1960, 1)];
      const result = generateShareText(ranges, 0, false, 42, {
        missDistance: 2,
        missDirection: "later",
      });

      const expected = `Chrondle #42

🟩⬜⬜⬜⬜⬜
🗓️ 11 years
🫠 2y late

https://chrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("Full Examples", () => {
    it("generates correct text for perfect win", () => {
      const ranges = [createRange(1950, 1950, 0)];
      const result = generateShareText(ranges, 100, true, 347);

      const expected = `Chrondle #347

⬜⬜⬜⬜⬜⬜
🗓️ 1 year
🎯 100/100

https://chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text with hints used", () => {
      const ranges = [createRange(1950, 1960, 3)];
      const result = generateShareText(ranges, 70, true, 123);

      const expected = `Chrondle #123

🟩🟩🟩⬜⬜⬜
🗓️ 11 years
😎 70/100

https://chrondle.app`;

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

    it("returns fallback text for ranges with invalid start type", () => {
      const invalidRanges = [
        { start: "not a number", end: 1950, hintsUsed: 0 },
      ] as unknown as RangeGuess[];
      const result = generateShareText(invalidRanges, 80, true);
      expect(result).toContain("Chrondle share text generation failed");
    });

    it("defaults hintsUsed to 0 when not provided", () => {
      const rangesWithoutHints = [
        {
          start: 1950,
          end: 1960,
          score: 50,
          timestamp: Date.now(),
        },
      ] as RangeGuess[];
      const result = generateShareText(rangesWithoutHints, 50, true, 1);
      expect(result).toContain("⬜⬜⬜⬜⬜⬜");
    });
  });
});
