import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { classifyPuzzle, isDailyPuzzle, isArchivePuzzle, PuzzleType } from "../puzzleType";

// =============================================================================
// classifyPuzzle
// =============================================================================

describe("classifyPuzzle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("with explicit currentDate parameter", () => {
    it("classifies puzzle as daily when dates match", () => {
      const result = classifyPuzzle("2025-10-16", "2025-10-16");

      expect(result).toEqual({ type: "daily", date: "2025-10-16" });
    });

    it("classifies puzzle as daily when date is yesterday (timezone envelope)", () => {
      // The canonical "today" is the PLAYER'S local day: after 00:00 UTC a
      // player's daily puzzle date is one day behind the server's UTC date.
      const result = classifyPuzzle("2025-10-15", "2025-10-16");

      expect(result).toEqual({ type: "daily", date: "2025-10-15" });
    });

    it("classifies puzzle as daily when date is tomorrow (timezone envelope)", () => {
      // Players ahead of UTC (up to UTC+14) legitimately play a puzzle dated
      // one day ahead of the server's UTC date.
      const result = classifyPuzzle("2025-10-17", "2025-10-16");

      expect(result).toEqual({ type: "daily", date: "2025-10-17" });
    });

    it("classifies puzzle as archive when date is two days in the past", () => {
      const result = classifyPuzzle("2025-10-14", "2025-10-16");

      expect(result).toEqual({ type: "archive", date: "2025-10-14" });
    });

    it("classifies puzzle as archive when date is two days in the future", () => {
      const result = classifyPuzzle("2025-10-18", "2025-10-16");

      expect(result).toEqual({ type: "archive", date: "2025-10-18" });
    });

    it("classifies puzzle as archive when date is far in the past", () => {
      const result = classifyPuzzle("2025-09-16", "2025-10-16");

      expect(result).toEqual({ type: "archive", date: "2025-09-16" });
    });
  });

  describe("without explicit currentDate (uses system time)", () => {
    it("classifies as daily when puzzle date matches UTC today", () => {
      // Set time to October 16, 2025 at noon UTC
      vi.setSystemTime(new Date("2025-10-16T12:00:00.000Z"));

      const result = classifyPuzzle("2025-10-16");

      expect(result).toEqual({ type: "daily", date: "2025-10-16" });
    });

    it("classifies as archive when puzzle date is two days before UTC today", () => {
      vi.setSystemTime(new Date("2025-10-16T12:00:00.000Z"));

      const result = classifyPuzzle("2025-10-14");

      expect(result).toEqual({ type: "archive", date: "2025-10-14" });
    });
  });

  describe("edge cases", () => {
    it("handles year boundary correctly (yesterday across new year is still daily)", () => {
      const result = classifyPuzzle("2024-12-31", "2025-01-01");

      expect(result).toEqual({ type: "daily", date: "2024-12-31" });
    });

    it("handles year boundary correctly (two days across new year is archive)", () => {
      const result = classifyPuzzle("2024-12-30", "2025-01-01");

      expect(result).toEqual({ type: "archive", date: "2024-12-30" });
    });

    it("handles leap year date", () => {
      const result = classifyPuzzle("2024-02-29", "2024-02-29");

      expect(result).toEqual({ type: "daily", date: "2024-02-29" });
    });
  });
});

// =============================================================================
// isDailyPuzzle
// =============================================================================

describe("isDailyPuzzle", () => {
  it("returns true for daily type", () => {
    const classification: PuzzleType = { type: "daily", date: "2025-10-16" };

    expect(isDailyPuzzle(classification)).toBe(true);
  });

  it("returns false for archive type", () => {
    const classification: PuzzleType = { type: "archive", date: "2025-10-15" };

    expect(isDailyPuzzle(classification)).toBe(false);
  });
});

// =============================================================================
// isArchivePuzzle
// =============================================================================

describe("isArchivePuzzle", () => {
  it("returns true for archive type", () => {
    const classification: PuzzleType = { type: "archive", date: "2025-10-15" };

    expect(isArchivePuzzle(classification)).toBe(true);
  });

  it("returns false for daily type", () => {
    const classification: PuzzleType = { type: "daily", date: "2025-10-16" };

    expect(isArchivePuzzle(classification)).toBe(false);
  });
});

// =============================================================================
// Integration: classifyPuzzle + type guards
// =============================================================================

describe("classifyPuzzle + type guards integration", () => {
  it("daily puzzle passes isDailyPuzzle guard", () => {
    const classification = classifyPuzzle("2025-10-16", "2025-10-16");

    expect(isDailyPuzzle(classification)).toBe(true);
    expect(isArchivePuzzle(classification)).toBe(false);
  });

  it("archive puzzle passes isArchivePuzzle guard", () => {
    const classification = classifyPuzzle("2025-10-13", "2025-10-16");

    expect(isDailyPuzzle(classification)).toBe(false);
    expect(isArchivePuzzle(classification)).toBe(true);
  });
});
