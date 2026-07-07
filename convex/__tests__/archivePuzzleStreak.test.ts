import { describe, it, expect } from "vitest";
import { shouldUpdateStreakForPuzzle } from "../lib/streakHelpers";

/**
 * Tests for archive puzzle streak isolation
 *
 * These tests exercise the REAL streak-guard decision used by
 * updateUserStreak (convex/lib/streakHelpers.ts).
 *
 * Day semantics: Chrondle's canonical "today" is the PLAYER'S local calendar
 * day, so a puzzle counts as "daily" when its date is within one day of the
 * server's UTC date (the timezone envelope, UTC-12..UTC+14). Genuinely
 * historical puzzles (2+ days out) must NEVER touch the streak, and playing
 * an older-dated puzzle after a newer completion must never rewind it.
 *
 * This prevents gaming the system by:
 * - Reviving dead streaks with historical completions
 * - Rewinding/resetting a streak by replaying an older day's puzzle
 * - Avoiding today's puzzle consequences with archive plays
 */
describe("Archive Puzzle Streak Isolation", () => {
  describe("Daily Puzzle Behavior (timezone envelope)", () => {
    it("updates streak when puzzle date matches server UTC today", () => {
      const decision = shouldUpdateStreakForPuzzle("2025-10-12", "2025-10-11", "2025-10-12");

      expect(decision).toEqual({ update: true, reason: "daily" });
    });

    it("updates streak when puzzle date is one day behind UTC (evening local play)", () => {
      // After 00:00 UTC, a US player's daily puzzle is dated UTC-yesterday.
      const decision = shouldUpdateStreakForPuzzle("2025-10-11", "2025-10-10", "2025-10-12");

      expect(decision).toEqual({ update: true, reason: "daily" });
    });

    it("updates streak when puzzle date is one day ahead of UTC (UTC+14 morning play)", () => {
      const decision = shouldUpdateStreakForPuzzle("2025-10-13", "2025-10-12", "2025-10-12");

      expect(decision).toEqual({ update: true, reason: "daily" });
    });

    it("allows same-day replay through to calculateStreakUpdate (which no-ops)", () => {
      const decision = shouldUpdateStreakForPuzzle("2025-10-12", "2025-10-12", "2025-10-12");

      expect(decision).toEqual({ update: true, reason: "daily" });
    });
  });

  describe("Archive Puzzle Behavior", () => {
    it.each([
      ["two days ago", "2025-10-10"],
      ["last week", "2025-10-05"],
      ["last month", "2025-09-12"],
      ["last year", "2024-10-12"],
      ["very old", "2020-01-01"],
    ])("does NOT update streak when playing %s puzzle", (_label, puzzleDate) => {
      const decision = shouldUpdateStreakForPuzzle(puzzleDate, null, "2025-10-12");

      expect(decision).toEqual({ update: false, reason: "archive" });
    });

    it("does NOT update streak for a far-future puzzle date", () => {
      const decision = shouldUpdateStreakForPuzzle("2025-10-14", null, "2025-10-12");

      expect(decision).toEqual({ update: false, reason: "archive" });
    });
  });

  describe("Never-Rewind Guard", () => {
    it("does NOT update streak when the puzzle is older than the last completion", () => {
      // UTC+14 player completed 10-13's puzzle, then replays 10-12's.
      const decision = shouldUpdateStreakForPuzzle("2025-10-12", "2025-10-13", "2025-10-12");

      expect(decision).toEqual({ update: false, reason: "older-than-last" });
    });

    it("does NOT let an in-envelope loss on an older day reset a newer streak", () => {
      const decision = shouldUpdateStreakForPuzzle("2025-10-11", "2025-10-12", "2025-10-12");

      expect(decision).toEqual({ update: false, reason: "older-than-last" });
    });
  });

  describe("Real-World Gaming Scenarios (Prevented)", () => {
    it("EXPLOIT PREVENTION: Cannot revive dead streak with old puzzles", () => {
      // User's streak reset weeks ago; completing many old puzzles must not
      // revive it. Only dates inside the envelope can count.
      const today = "2025-10-12";
      const oldPuzzles = ["2025-10-09", "2025-10-08", "2025-10-07", "2025-09-01"];

      oldPuzzles.forEach((puzzleDate) => {
        expect(shouldUpdateStreakForPuzzle(puzzleDate, "2025-09-30", today)).toEqual({
          update: false,
          reason: "archive",
        });
      });
    });

    it("EXPLOIT PREVENTION: Cannot avoid today's puzzle with archive plays", () => {
      // Playing easy archive puzzles does not extend the streak deadline.
      const today = "2025-10-12";
      const safeArchivePuzzles = ["2025-10-05", "2025-09-20"];

      safeArchivePuzzles.forEach((puzzleDate) => {
        expect(shouldUpdateStreakForPuzzle(puzzleDate, "2025-10-11", today).update).toBe(false);
      });

      // Today's puzzle is what keeps the streak alive.
      expect(shouldUpdateStreakForPuzzle(today, "2025-10-11", today)).toEqual({
        update: true,
        reason: "daily",
      });
    });

    it("EDGE OF ENVELOPE: playing one day late is indistinguishable from an honest timezone", () => {
      // A puzzle dated UTC-yesterday can be a legitimate local-today play
      // (US evening), so it is admitted; anything older is not.
      const today = "2025-10-12";

      expect(shouldUpdateStreakForPuzzle("2025-10-11", "2025-10-10", today).update).toBe(true);
      expect(shouldUpdateStreakForPuzzle("2025-10-10", "2025-10-09", today).update).toBe(false);
    });
  });

  describe("Month/Year Boundaries", () => {
    it("handles month boundary inside the envelope", () => {
      expect(shouldUpdateStreakForPuzzle("2025-10-31", "2025-10-30", "2025-11-01").update).toBe(
        true,
      );
    });

    it("handles year boundary inside the envelope", () => {
      expect(shouldUpdateStreakForPuzzle("2025-12-31", "2025-12-30", "2026-01-01").update).toBe(
        true,
      );
    });

    it("rejects two-day gaps across year boundary", () => {
      expect(shouldUpdateStreakForPuzzle("2025-12-30", "2025-12-29", "2026-01-01")).toEqual({
        update: false,
        reason: "archive",
      });
    });
  });
});
