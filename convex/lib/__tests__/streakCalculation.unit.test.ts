import { describe, it, expect } from "vitest";
import {
  calculateStreak,
  calculateStreakUpdate,
  applyStreakUpdate,
  getActiveStreak,
  getUTCDateString,
  isConsecutiveDay,
} from "../streakCalculation";

describe("Streak Calculation Utilities", () => {
  describe("getUTCDateString", () => {
    it("should format current date as ISO string", () => {
      const result = getUTCDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should format specific date correctly", () => {
      const date = new Date("2024-12-25T15:30:00.000Z");
      expect(getUTCDateString(date)).toBe("2024-12-25");
    });

    it("should handle UTC timezone correctly", () => {
      // 11:59 PM Dec 31 in UTC is still Dec 31
      const date = new Date("2024-12-31T23:59:59.999Z");
      expect(getUTCDateString(date)).toBe("2024-12-31");
    });

    it("should pad month and day with zeros", () => {
      const date = new Date("2024-01-05T00:00:00.000Z");
      expect(getUTCDateString(date)).toBe("2024-01-05");
    });
  });

  describe("isConsecutiveDay", () => {
    it("should return true for consecutive days", () => {
      expect(isConsecutiveDay("2025-10-07", "2025-10-08")).toBe(true);
    });

    it("should return false for same day", () => {
      expect(isConsecutiveDay("2025-10-07", "2025-10-07")).toBe(false);
    });

    it("should return false for gap of 2 days", () => {
      expect(isConsecutiveDay("2025-10-07", "2025-10-09")).toBe(false);
    });

    it("should return false for gap of 7 days", () => {
      expect(isConsecutiveDay("2025-10-01", "2025-10-08")).toBe(false);
    });

    it("should handle month boundary correctly", () => {
      expect(isConsecutiveDay("2025-09-30", "2025-10-01")).toBe(true);
    });

    it("should handle year boundary correctly", () => {
      expect(isConsecutiveDay("2024-12-31", "2025-01-01")).toBe(true);
    });

    it("should handle leap year correctly", () => {
      expect(isConsecutiveDay("2024-02-28", "2024-02-29")).toBe(true);
      expect(isConsecutiveDay("2024-02-29", "2024-03-01")).toBe(true);
    });

    it("should handle non-leap year correctly", () => {
      expect(isConsecutiveDay("2023-02-28", "2023-03-01")).toBe(true);
    });

    it("should throw error for invalid first date", () => {
      expect(() => isConsecutiveDay("invalid", "2025-10-08")).toThrow("Invalid first date");
    });

    it("should throw error for invalid second date", () => {
      expect(() => isConsecutiveDay("2025-10-07", "invalid")).toThrow("Invalid second date");
    });

    it("should throw error for malformed date (wrong format)", () => {
      expect(() => isConsecutiveDay("2025/10/07", "2025-10-08")).toThrow("Invalid first date");
    });

    it("should throw error for impossible date", () => {
      expect(() => isConsecutiveDay("2025-13-01", "2025-10-08")).toThrow("Invalid first date");
    });

    it("should throw error for empty string", () => {
      expect(() => isConsecutiveDay("", "2025-10-08")).toThrow("Invalid first date");
    });
  });

  describe("getActiveStreak", () => {
    it("keeps the stored streak when the last win was today or yesterday", () => {
      expect(getActiveStreak(2, "2026-10-20", "2026-10-20")).toBe(2);
      expect(getActiveStreak(2, "2026-10-19", "2026-10-20")).toBe(2);
    });

    it("reads 0 once a day has been missed", () => {
      expect(getActiveStreak(2, "2026-10-18", "2026-10-20")).toBe(0);
      expect(getActiveStreak(30, "2026-09-30", "2026-10-20")).toBe(0);
    });

    it("keeps a streak dated ahead of the reader's day (another timezone)", () => {
      expect(getActiveStreak(4, "2026-10-21", "2026-10-20")).toBe(4);
    });

    it("crosses month and year boundaries", () => {
      expect(getActiveStreak(3, "2026-12-31", "2027-01-01")).toBe(3);
      expect(getActiveStreak(3, "2026-12-30", "2027-01-01")).toBe(0);
    });

    it("reads 0 for missing or invalid dates instead of throwing", () => {
      expect(getActiveStreak(5, null, "2026-10-20")).toBe(0);
      expect(getActiveStreak(5, "", "2026-10-20")).toBe(0);
      expect(getActiveStreak(5, "2026-13-45", "2026-10-20")).toBe(0);
      expect(getActiveStreak(5, "2026-10-19", "0000-00-00")).toBe(0);
    });
  });

  describe("calculateStreak", () => {
    describe("First Play Scenarios", () => {
      it("should return streak=1 for first play won", () => {
        const result = calculateStreak(null, 0, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should return streak=0 for first play lost", () => {
        const result = calculateStreak(null, 0, "2025-10-08", false);
        expect(result).toEqual({
          currentStreak: 0,
          lastCompletedDate: "2025-10-08",
        });
      });
    });

    describe("Same Day Scenarios", () => {
      it("should return streak=0 for same day completion (already played)", () => {
        const result = calculateStreak("2025-10-08", 5, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 0, // Signal: no update
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should return streak=0 for same day loss", () => {
        const result = calculateStreak("2025-10-08", 5, "2025-10-08", false);
        expect(result).toEqual({
          currentStreak: 0,
          lastCompletedDate: "2025-10-08",
        });
      });
    });

    describe("Consecutive Day Scenarios", () => {
      it("should increment streak for consecutive day won", () => {
        const result = calculateStreak("2025-10-07", 5, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 6,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should reset streak to 0 for consecutive day lost", () => {
        const result = calculateStreak("2025-10-07", 5, "2025-10-08", false);
        expect(result).toEqual({
          currentStreak: 0,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should handle streak increment from 0 to 1", () => {
        const result = calculateStreak("2025-10-07", 0, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should handle large streak increment (99 → 100)", () => {
        const result = calculateStreak("2025-10-07", 99, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 100,
          lastCompletedDate: "2025-10-08",
        });
      });
    });

    describe("Gap Scenarios (Streak Reset)", () => {
      it("should reset to streak=1 for 2-day gap won", () => {
        const result = calculateStreak("2025-10-05", 10, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should reset to streak=0 for 2-day gap lost", () => {
        const result = calculateStreak("2025-10-05", 10, "2025-10-08", false);
        expect(result).toEqual({
          currentStreak: 0,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should reset to streak=1 for 7-day gap won", () => {
        const result = calculateStreak("2025-10-01", 50, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should reset to streak=1 for 30-day gap won", () => {
        const result = calculateStreak("2025-09-08", 100, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle month boundary (Sept 30 → Oct 1)", () => {
        const result = calculateStreak("2025-09-30", 7, "2025-10-01", true);
        expect(result).toEqual({
          currentStreak: 8,
          lastCompletedDate: "2025-10-01",
        });
      });

      it("should handle year boundary (Dec 31 → Jan 1)", () => {
        const result = calculateStreak("2024-12-31", 20, "2025-01-01", true);
        expect(result).toEqual({
          currentStreak: 21,
          lastCompletedDate: "2025-01-01",
        });
      });

      it("should handle leap year Feb 28 → 29", () => {
        const result = calculateStreak("2024-02-28", 15, "2024-02-29", true);
        expect(result).toEqual({
          currentStreak: 16,
          lastCompletedDate: "2024-02-29",
        });
      });

      it("should handle leap year Feb 29 → Mar 1", () => {
        const result = calculateStreak("2024-02-29", 15, "2024-03-01", true);
        expect(result).toEqual({
          currentStreak: 16,
          lastCompletedDate: "2024-03-01",
        });
      });

      it("should handle non-leap year Feb 28 → Mar 1", () => {
        const result = calculateStreak("2023-02-28", 15, "2023-03-01", true);
        expect(result).toEqual({
          currentStreak: 16,
          lastCompletedDate: "2023-03-01",
        });
      });
    });

    describe("Win After Loss Scenarios", () => {
      it("should start new streak=1 after loss (gap)", () => {
        const result = calculateStreak("2025-10-05", 0, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should start new streak=1 after loss (consecutive)", () => {
        const result = calculateStreak("2025-10-07", 0, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });
    });

    describe("Multiple Consecutive Wins", () => {
      it("should correctly increment through multiple wins", () => {
        let result = calculateStreak(null, 0, "2025-10-05", true);
        expect(result.currentStreak).toBe(1);

        result = calculateStreak(
          result.lastCompletedDate,
          result.currentStreak,
          "2025-10-06",
          true,
        );
        expect(result.currentStreak).toBe(2);

        result = calculateStreak(
          result.lastCompletedDate,
          result.currentStreak,
          "2025-10-07",
          true,
        );
        expect(result.currentStreak).toBe(3);

        result = calculateStreak(
          result.lastCompletedDate,
          result.currentStreak,
          "2025-10-08",
          true,
        );
        expect(result.currentStreak).toBe(4);
      });
    });

    describe("Error Handling", () => {
      it("should throw error for invalid today date", () => {
        expect(() => calculateStreak(null, 0, "invalid", true)).toThrow("Invalid today date");
      });

      it("should throw error for invalid lastCompletedDate", () => {
        expect(() => calculateStreak("invalid", 5, "2025-10-08", true)).toThrow(
          "Invalid last completed date",
        );
      });

      it("should throw error for empty string today date", () => {
        expect(() => calculateStreak(null, 0, "", true)).toThrow("Invalid today date");
      });

      it("should throw error for malformed date format", () => {
        expect(() => calculateStreak(null, 0, "2025/10/08", true)).toThrow("Invalid today date");
      });

      it("should throw error for impossible date", () => {
        expect(() => calculateStreak(null, 0, "2025-13-01", true)).toThrow("Invalid today date");
      });
    });

    describe("Edge Cases", () => {
      it("should handle very old lastCompletedDate (1 year gap)", () => {
        const result = calculateStreak("2024-10-08", 50, "2025-10-08", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-08",
        });
      });

      it("should handle streak starting on Jan 1", () => {
        const result = calculateStreak(null, 0, "2025-01-01", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-01-01",
        });
      });

      it("should handle streak starting on Dec 31", () => {
        const result = calculateStreak(null, 0, "2025-12-31", true);
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-12-31",
        });
      });
    });
  });

  describe("calculateStreakUpdate (Discriminated Union)", () => {
    describe("no-change updates", () => {
      it("should return no-change for same-day replay", () => {
        const update = calculateStreakUpdate("2025-10-09", 5, "2025-10-09", true);
        expect(update).toEqual({
          type: "no-change",
          reason: "same-day-replay",
        });
      });

      it("should return no-change even when hasWon=false on same day", () => {
        const update = calculateStreakUpdate("2025-10-09", 5, "2025-10-09", false);
        expect(update).toEqual({
          type: "no-change",
          reason: "same-day-replay",
        });
      });
    });

    describe("increment updates", () => {
      it("should increment for consecutive day win", () => {
        const update = calculateStreakUpdate("2025-10-08", 5, "2025-10-09", true);
        expect(update).toEqual({
          type: "increment",
          newStreak: 6,
          date: "2025-10-09",
          reason: "consecutive-day-win",
        });
      });

      it("should increment from 1 to 2", () => {
        const update = calculateStreakUpdate("2025-10-08", 1, "2025-10-09", true);
        expect(update).toEqual({
          type: "increment",
          newStreak: 2,
          date: "2025-10-09",
          reason: "consecutive-day-win",
        });
      });
    });

    describe("reset updates", () => {
      it("should reset on loss (consecutive day)", () => {
        const update = calculateStreakUpdate("2025-10-08", 5, "2025-10-09", false);
        expect(update).toEqual({
          type: "reset",
          date: "2025-10-09",
          reason: "loss",
        });
      });

      it("should reset on loss (gap)", () => {
        const update = calculateStreakUpdate("2025-10-05", 10, "2025-10-09", false);
        expect(update).toEqual({
          type: "reset",
          date: "2025-10-09",
          reason: "loss",
        });
      });
    });

    describe("initialize updates", () => {
      it("should initialize on first win", () => {
        const update = calculateStreakUpdate(null, 0, "2025-10-09", true);
        expect(update).toEqual({
          type: "initialize",
          date: "2025-10-09",
          reason: "first-win",
        });
      });

      it("should restart after gap (missed days)", () => {
        const update = calculateStreakUpdate("2025-10-05", 10, "2025-10-09", true);
        expect(update).toEqual({
          type: "initialize",
          date: "2025-10-09",
          reason: "restart-after-gap",
        });
      });

      it("should restart after 1-day gap", () => {
        const update = calculateStreakUpdate("2025-10-07", 5, "2025-10-09", true);
        expect(update).toEqual({
          type: "initialize",
          date: "2025-10-09",
          reason: "restart-after-gap",
        });
      });
    });
  });

  describe("applyStreakUpdate", () => {
    describe("no-change updates", () => {
      it("should preserve state on no-change", () => {
        const result = applyStreakUpdate(
          { currentStreak: 5, lastCompletedDate: "2025-10-09" },
          { type: "no-change", reason: "same-day-replay" },
        );
        expect(result).toEqual({
          currentStreak: 5,
          lastCompletedDate: "2025-10-09",
        });
      });

      it("should handle null lastCompletedDate on no-change", () => {
        const result = applyStreakUpdate(
          { currentStreak: 0, lastCompletedDate: null },
          { type: "no-change", reason: "same-day-replay" },
        );
        expect(result).toEqual({
          currentStreak: 0,
          lastCompletedDate: "",
        });
      });
    });

    describe("increment updates", () => {
      it("should apply increment correctly", () => {
        const result = applyStreakUpdate(
          { currentStreak: 5, lastCompletedDate: "2025-10-08" },
          {
            type: "increment",
            newStreak: 6,
            date: "2025-10-09",
            reason: "consecutive-day-win",
          },
        );
        expect(result).toEqual({
          currentStreak: 6,
          lastCompletedDate: "2025-10-09",
        });
      });
    });

    describe("reset updates", () => {
      it("should reset streak to zero", () => {
        const result = applyStreakUpdate(
          { currentStreak: 10, lastCompletedDate: "2025-10-08" },
          { type: "reset", date: "2025-10-09", reason: "loss" },
        );
        expect(result).toEqual({
          currentStreak: 0,
          lastCompletedDate: "2025-10-09",
        });
      });
    });

    describe("initialize updates", () => {
      it("should start new streak at 1", () => {
        const result = applyStreakUpdate(
          { currentStreak: 0, lastCompletedDate: null },
          { type: "initialize", date: "2025-10-09", reason: "first-win" },
        );
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-09",
        });
      });

      it("should restart streak at 1 after gap", () => {
        const result = applyStreakUpdate(
          { currentStreak: 10, lastCompletedDate: "2025-10-05" },
          { type: "initialize", date: "2025-10-09", reason: "restart-after-gap" },
        );
        expect(result).toEqual({
          currentStreak: 1,
          lastCompletedDate: "2025-10-09",
        });
      });
    });
  });
});
