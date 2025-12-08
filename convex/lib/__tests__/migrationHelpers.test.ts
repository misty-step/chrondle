import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { legacyGuessesToRanges, normalizePlayData, type RangeRecord } from "../migrationHelpers";
import type { Doc } from "../../_generated/dataModel";

describe("migrationHelpers", () => {
  describe("legacyGuessesToRanges", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns empty array for undefined guesses", () => {
      const result = legacyGuessesToRanges(undefined);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty guesses", () => {
      const result = legacyGuessesToRanges([]);
      expect(result).toEqual([]);
    });

    it("converts single guess to range", () => {
      const result = legacyGuessesToRanges([1969]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        start: 1969,
        end: 1969,
        hintsUsed: 0,
        score: 0,
        timestamp: Date.now(),
      });
    });

    it("converts multiple guesses to ranges with incremental timestamps", () => {
      const result = legacyGuessesToRanges([1969, 1970, 1968]);

      expect(result).toHaveLength(3);

      // Each guess becomes a single-year range
      expect(result[0].start).toBe(1969);
      expect(result[0].end).toBe(1969);
      expect(result[1].start).toBe(1970);
      expect(result[1].end).toBe(1970);
      expect(result[2].start).toBe(1968);
      expect(result[2].end).toBe(1968);

      // Timestamps increment by 100ms each
      const baseTime = Date.now();
      expect(result[0].timestamp).toBe(baseTime);
      expect(result[1].timestamp).toBe(baseTime + 100);
      expect(result[2].timestamp).toBe(baseTime + 200);
    });

    it("uses provided starting timestamp", () => {
      const customTimestamp = 1700000000000;
      const result = legacyGuessesToRanges([1969, 1970], { startingTimestamp: customTimestamp });

      expect(result[0].timestamp).toBe(customTimestamp);
      expect(result[1].timestamp).toBe(customTimestamp + 100);
    });

    it("sets hintsUsed and score to 0 for all ranges", () => {
      const result = legacyGuessesToRanges([1969, 1970, 1968]);

      for (const range of result) {
        expect(range.hintsUsed).toBe(0);
        expect(range.score).toBe(0);
      }
    });

    it("handles negative years (BC)", () => {
      const result = legacyGuessesToRanges([-500, -400]);

      expect(result[0].start).toBe(-500);
      expect(result[0].end).toBe(-500);
      expect(result[1].start).toBe(-400);
      expect(result[1].end).toBe(-400);
    });
  });

  describe("normalizePlayData", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns null for null input", () => {
      const result = normalizePlayData(null);
      expect(result).toBeNull();
    });

    it("preserves existing ranges if present", () => {
      const existingRanges: RangeRecord[] = [
        { start: 1960, end: 1980, hintsUsed: 2, score: 50, timestamp: 1700000000000 },
      ];

      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        ranges: existingRanges,
        totalScore: 50,
        guesses: [1969],
        updatedAt: 1700000000000,
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      expect(result?.ranges).toEqual(existingRanges);
      expect(result?.totalScore).toBe(50);
    });

    it("converts legacy guesses to ranges when no ranges exist", () => {
      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        ranges: [],
        guesses: [1969, 1970],
        updatedAt: 1700000000000,
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      expect(result?.ranges).toHaveLength(2);
      expect(result?.ranges[0].start).toBe(1969);
      expect(result?.ranges[0].end).toBe(1969);
    });

    it("converts undefined ranges to legacy guesses", () => {
      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        guesses: [1969],
        updatedAt: 1700000000000,
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      expect(result?.ranges).toHaveLength(1);
    });

    it("calculates totalScore from ranges if not provided", () => {
      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        ranges: [
          { start: 1960, end: 1980, hintsUsed: 2, score: 30, timestamp: 1700000000000 },
          { start: 1965, end: 1975, hintsUsed: 1, score: 45, timestamp: 1700000001000 },
        ],
        guesses: [],
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      expect(result?.totalScore).toBe(75); // 30 + 45
    });

    it("preserves explicit totalScore if provided", () => {
      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        ranges: [{ start: 1960, end: 1980, hintsUsed: 2, score: 30, timestamp: 1700000000000 }],
        totalScore: 100, // Explicit total
        guesses: [],
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      expect(result?.totalScore).toBe(100);
    });

    it("defaults guesses to empty array if undefined", () => {
      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        ranges: [{ start: 1960, end: 1980, hintsUsed: 0, score: 50, timestamp: 1700000000000 }],
        totalScore: 50,
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      expect(result?.guesses).toEqual([]);
    });

    it("uses Date.now() when updatedAt is missing", () => {
      const play = {
        _id: "test-id",
        _creationTime: 1700000000000,
        puzzleId: "puzzle-id",
        userId: "user-id",
        ranges: [],
        guesses: [1969],
      } as unknown as Doc<"plays">;

      const result = normalizePlayData(play);

      // Should use current time for timestamp
      expect(result?.ranges[0].timestamp).toBe(Date.now());
    });
  });
});
