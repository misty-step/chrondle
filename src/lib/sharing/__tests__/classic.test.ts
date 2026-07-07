import { describe, it, expect, vi } from "vitest";
import { generateClassicShareText } from "../classic";
import { RangeGuess } from "@/types/range";

// Mock logger to prevent console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("generateClassicShareText", () => {
  const createRange = (start: number, end: number, hintsUsed = 0): RangeGuess => ({
    start,
    end,
    hintsUsed: hintsUsed as RangeGuess["hintsUsed"],
    score: 0,
    timestamp: Date.now(),
  });

  describe("Header (shared format family)", () => {
    it("shows standard header with puzzle number: Chrondle #347", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateClassicShareText(ranges, 100, true, 347);
      expect(result.startsWith("Chrondle #347\n\n")).toBe(true);
    });

    it("omits puzzle number when not provided", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateClassicShareText(ranges, 100, true);
      expect(result.startsWith("Chrondle\n\n")).toBe(true);
      expect(result).not.toContain("#");
    });

    it("ends with the chrondle.app footer", () => {
      const ranges = [createRange(1950, 1950)];
      const result = generateClassicShareText(ranges, 100, true, 347);
      expect(result.endsWith("\n\nhttps://chrondle.app")).toBe(true);
    });
  });

  describe("Timeline band (range mechanic)", () => {
    it("contained: green band centered with 🎯 at its center (lab fixture W)", () => {
      // 21-year range, contained → band length 5, centered, target mid-band
      const ranges = [createRange(1900, 1920, 3)];
      const result = generateClassicShareText(ranges, 92, true, 96);
      expect(result).toContain("⬜⬜🟩🟩🎯🟩🟩⬜⬜⬜");
    });

    it("missed: amber band with 🎯 beyond the band on the miss side (lab fixture L)", () => {
      // 30-year range, missed 34y early (> 25) → target 2 cells beyond band, right side
      const ranges = [createRange(1900, 1929, 4)];
      const result = generateClassicShareText(ranges, 0, false, 96, {
        missDistance: 34,
        missDirection: "earlier",
      });
      expect(result).toContain("⬜🟨🟨🟨🟨🟨⬜🎯⬜⬜");
    });

    it("missed late: figure mirrored, 🎯 on the left of the band", () => {
      const ranges = [createRange(1900, 1929, 4)];
      const result = generateClassicShareText(ranges, 0, false, 96, {
        missDistance: 34,
        missDirection: "later",
      });
      expect(result).toContain("⬜⬜🎯⬜🟨🟨🟨🟨🟨⬜");
    });

    it("near miss (≤ 25 years): 🎯 only 1 cell beyond the band", () => {
      const ranges = [createRange(1900, 1929, 4)];
      const result = generateClassicShareText(ranges, 0, false, 96, {
        missDistance: 5,
        missDirection: "earlier",
      });
      expect(result).toContain("⬜⬜🟨🟨🟨🟨🟨🎯⬜⬜");
    });

    it("1-year range renders the narrowest band", () => {
      const ranges = [createRange(1950, 1950, 0)];
      const result = generateClassicShareText(ranges, 100, true, 347);
      expect(result).toContain("⬜⬜⬜⬜🎯⬜⬜⬜⬜⬜");
    });

    it("very wide range clamps to the maximum band length", () => {
      const ranges = [createRange(1000, 1999, 6)];
      const result = generateClassicShareText(ranges, 10, true, 347);
      expect(result).toContain("⬜🟩🟩🟩🟩🎯🟩🟩🟩⬜");
    });

    it("loss without miss info renders a centered amber band without 🎯", () => {
      const ranges = [createRange(1900, 1929, 4)];
      const result = generateClassicShareText(ranges, 0, false, 96);
      expect(result).toContain("⬜⬜🟨🟨🟨🟨🟨⬜⬜⬜");
    });
  });

  describe("Stat line", () => {
    it("shows width and hints: 📏 21 years · 🔍 3 hints", () => {
      const ranges = [createRange(1900, 1920, 3)];
      const result = generateClassicShareText(ranges, 92, true, 96);
      expect(result).toContain("📏 21 years · 🔍 3 hints");
    });

    it("uses singular forms for width 1 and 1 hint", () => {
      const ranges = [createRange(1900, 1900, 1)];
      const result = generateClassicShareText(ranges, 100, true, 347);
      expect(result).toContain("📏 1 year · 🔍 1 hint");
    });

    it("omits the hint part at 0 hints", () => {
      const ranges = [createRange(1900, 1914, 0)];
      const result = generateClassicShareText(ranges, 85, true, 347);
      expect(result).toContain("📏 15 years\n");
      expect(result).not.toContain("🔍");
    });
  });

  describe("Score line", () => {
    it("shows Bullseye for 100", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 100, true, 347);
      expect(result).toContain("🎯 100/100");
    });

    it("shows Fire for 90-99", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 95, true, 347);
      expect(result).toContain("🔥 95/100");
    });

    it("shows Star for 80-89", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 85, true, 347);
      expect(result).toContain("⭐ 85/100");
    });

    it("shows Sunglasses for 70-79", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 75, true, 347);
      expect(result).toContain("😎 75/100");
    });

    it("shows Thumbs Up for < 70 (won)", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 60, true, 347);
      expect(result).toContain("👍 60/100");
    });

    it("shows melting face with score for loss without miss info", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 40, false, 347);
      expect(result).toContain("🫠 40/100");
    });

    it("shows 'Xy early' for earlier miss", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 5,
        missDirection: "earlier",
      });
      expect(result).toContain("🫠 5y early");
    });

    it("shows 'Xy late' for later miss", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 3,
        missDirection: "later",
      });
      expect(result).toContain("🫠 3y late");
    });

    it("keeps win format when hasWon is true even with miss info", () => {
      const ranges = [createRange(1950, 1960, 2)];
      const result = generateClassicShareText(ranges, 75, true, 347, {
        missDistance: 5,
        missDirection: "earlier",
      });
      expect(result).toContain("😎 75/100");
      expect(result).not.toContain("5y early");
    });
  });

  describe("Full examples (locked lab spec, Option B)", () => {
    it("win fixture W: 21-year range, 3 hints, 92/100", () => {
      const ranges = [createRange(1900, 1920, 3)];
      const result = generateClassicShareText(ranges, 92, true, 96);
      expect(result).toBe(
        `Chrondle #96\n\n⬜⬜🟩🟩🎯🟩🟩⬜⬜⬜\n📏 21 years · 🔍 3 hints\n🔥 92/100\n\nhttps://chrondle.app`,
      );
    });

    it("loss fixture L: 30-year range, 4 hints, 34y early", () => {
      const ranges = [createRange(1900, 1929, 4)];
      const result = generateClassicShareText(ranges, 0, false, 96, {
        missDistance: 34,
        missDirection: "earlier",
      });
      expect(result).toBe(
        `Chrondle #96\n\n⬜🟨🟨🟨🟨🟨⬜🎯⬜⬜\n📏 30 years · 🔍 4 hints\n🫠 34y early\n\nhttps://chrondle.app`,
      );
    });
  });

  describe("Error handling", () => {
    it("returns fallback text for invalid ranges", () => {
      const result = generateClassicShareText(null as unknown as RangeGuess[], 80, true);
      expect(result).toContain("Chrondle share text generation failed");
    });

    it("returns fallback text for empty ranges", () => {
      const result = generateClassicShareText([], 0, false);
      expect(result).toContain("Chrondle share text generation failed");
    });

    it("returns fallback text for ranges with invalid start type", () => {
      const invalidRanges = [
        { start: "not a number", end: 1950, hintsUsed: 0 },
      ] as unknown as RangeGuess[];
      const result = generateClassicShareText(invalidRanges, 80, true);
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
      const result = generateClassicShareText(rangesWithoutHints, 50, true, 1);
      expect(result).not.toContain("🔍");
    });
  });
});
