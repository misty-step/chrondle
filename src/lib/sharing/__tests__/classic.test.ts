import { describe, it, expect, vi } from "vitest";
import { generateClassicShareText } from "../classic";
import { CHRONDLE_URL, SHARE_PITCH } from "../format";
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

  describe("header (shared format family)", () => {
    it("shows standard header with puzzle number: Chrondle #347", () => {
      const result = generateClassicShareText([createRange(1950, 1950)], 100, true, 347);
      expect(result).toContain("Chrondle #347");
    });

    it("omits puzzle number when not provided", () => {
      const result = generateClassicShareText([createRange(1950, 1950)], 100, true);
      expect(result).toContain("Chrondle");
      expect(result).not.toContain("#");
    });

    it("leaves a blank line between header and body", () => {
      const result = generateClassicShareText([createRange(1950, 1950)], 100, true, 347);
      expect(result.startsWith("Chrondle #347\n\n")).toBe(true);
    });
  });

  describe("narrowing funnel (outcome class: win)", () => {
    it("shows the width sequence across every guess, narrowing left to right", () => {
      const ranges = [
        createRange(1700, 1949, 0),
        createRange(1900, 1960, 1),
        createRange(1945, 1959, 2),
      ];
      const result = generateClassicShareText(ranges, 85, true, 347);
      expect(result).toContain("🔻 250 → 61 → 15y");
    });

    it("degrades to a single width on a first-guess win", () => {
      const result = generateClassicShareText([createRange(1950, 1950)], 100, true, 347);
      expect(result).toContain("🔻 1y");
    });

    it("shows the Contained outcome line on a win", () => {
      const result = generateClassicShareText([createRange(1945, 1959)], 85, true, 347);
      expect(result).toContain("✅ Contained");
    });
  });

  describe("narrowing funnel (outcome class: loss)", () => {
    it("shows the Missed outcome line with distance and direction: earlier", () => {
      const ranges = [createRange(1950, 1960)];
      const result = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 5,
        missDirection: "earlier",
      });
      expect(result).toContain("❌ 5y early");
    });

    it("shows the Missed outcome line with distance and direction: later", () => {
      const ranges = [createRange(1950, 1960)];
      const result = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 3,
        missDirection: "later",
      });
      expect(result).toContain("❌ 3y late");
    });

    it("falls back to a generic Missed line when miss info is absent", () => {
      const ranges = [createRange(1950, 1960)];
      const result = generateClassicShareText(ranges, 0, false, 347);
      expect(result).toContain("❌ Missed");
    });

    it("falls back to a generic Missed line when direction is null", () => {
      const ranges = [createRange(1950, 1960)];
      const result = generateClassicShareText(ranges, 0, false, 347, {
        missDistance: 5,
        missDirection: null,
      });
      expect(result).toContain("❌ Missed");
    });
  });

  describe("score line", () => {
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

    it("shows Thumbs Up for < 70 (Won)", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 60, true, 347);
      expect(result).toContain("👍 60/100");
    });

    it("shows melting face for Loss regardless of score", () => {
      const result = generateClassicShareText([createRange(1900, 1900)], 40, false, 347);
      expect(result).toContain("🫠 40/100");
    });
  });

  describe("full examples per outcome class", () => {
    it("generates correct text for perfect win", () => {
      const result = generateClassicShareText([createRange(1950, 1950)], 100, true, 347);

      const expected = `Chrondle #347

🔻 1y
✅ Contained
🎯 100/100

A daily history puzzle: read the clues, guess the year. One real event per day, free at chrondle.app.
https://chrondle.app`;

      expect(result).toBe(expected);
    });

    it("includes the pitch and URL as plain text for social previews", () => {
      const result = generateClassicShareText([createRange(1950, 1950)], 100, true, 347);

      expect(result).toContain(SHARE_PITCH);
      expect(result).toContain(CHRONDLE_URL);
      expect(result.endsWith(`${SHARE_PITCH}\n${CHRONDLE_URL}`)).toBe(true);
    });

    it("generates correct text for a multi-guess win", () => {
      const ranges = [
        createRange(1700, 1949, 0),
        createRange(1900, 1960, 2),
        createRange(1945, 1959, 3),
      ];
      const result = generateClassicShareText(ranges, 70, true, 123);

      const expected = `Chrondle #123

🔻 250 → 61 → 15y
✅ Contained
😎 70/100

A daily history puzzle: read the clues, guess the year. One real event per day, free at chrondle.app.
https://chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for a loss with an earlier miss", () => {
      const ranges = [createRange(1700, 1949, 0), createRange(1950, 1960, 3)];
      const result = generateClassicShareText(ranges, 0, false, 123, {
        missDistance: 7,
        missDirection: "earlier",
      });

      const expected = `Chrondle #123

🔻 250 → 11y
❌ 7y early
🫠 0/100

A daily history puzzle: read the clues, guess the year. One real event per day, free at chrondle.app.
https://chrondle.app`;

      expect(result).toBe(expected);
    });

    it("generates correct text for a loss with a later miss", () => {
      const ranges = [createRange(1950, 1960, 1)];
      const result = generateClassicShareText(ranges, 0, false, 42, {
        missDistance: 2,
        missDirection: "later",
      });

      const expected = `Chrondle #42

🔻 11y
❌ 2y late
🫠 0/100

A daily history puzzle: read the clues, guess the year. One real event per day, free at chrondle.app.
https://chrondle.app`;

      expect(result).toBe(expected);
    });
  });

  describe("error handling", () => {
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
  });
});
