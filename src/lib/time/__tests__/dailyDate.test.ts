import { describe, it, expect } from "vitest";
import {
  getLocalDateString,
  getUTCDateString,
  areDatesEqual,
  getMillisUntilLocalMidnight,
} from "../dailyDate";

describe("dailyDate", () => {
  describe("getLocalDateString", () => {
    it("returns date in YYYY-MM-DD format", () => {
      const date = new Date("2024-03-15T14:30:00");
      const result = getLocalDateString(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("pads single digit months and days", () => {
      // January 5th, 2024
      const date = new Date(2024, 0, 5);
      const result = getLocalDateString(date);
      expect(result).toBe("2024-01-05");
    });

    it("handles end of year correctly", () => {
      const date = new Date(2024, 11, 31); // December 31st
      const result = getLocalDateString(date);
      expect(result).toBe("2024-12-31");
    });

    it("returns fallback for invalid date", () => {
      const invalidDate = new Date("invalid");
      const result = getLocalDateString(invalidDate);
      expect(result).toBe("0000-00-00");
    });

    it("uses current date when no argument provided", () => {
      const result = getLocalDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getUTCDateString", () => {
    it("returns UTC date in YYYY-MM-DD format", () => {
      // Create a date at specific UTC time
      const date = new Date(Date.UTC(2024, 2, 15, 14, 30)); // March 15, 2024 UTC
      const result = getUTCDateString(date);
      expect(result).toBe("2024-03-15");
    });

    it("handles UTC day boundary correctly", () => {
      // Late night UTC - should still be March 15
      const date = new Date(Date.UTC(2024, 2, 15, 23, 59));
      expect(getUTCDateString(date)).toBe("2024-03-15");

      // Just past midnight UTC - should be March 16
      const nextDay = new Date(Date.UTC(2024, 2, 16, 0, 1));
      expect(getUTCDateString(nextDay)).toBe("2024-03-16");
    });

    it("returns fallback for invalid date", () => {
      const invalidDate = new Date("invalid");
      const result = getUTCDateString(invalidDate);
      expect(result).toBe("0000-00-00");
    });
  });

  describe("areDatesEqual", () => {
    it("returns true for equal dates", () => {
      expect(areDatesEqual("2024-03-15", "2024-03-15")).toBe(true);
    });

    it("returns false for different dates", () => {
      expect(areDatesEqual("2024-03-15", "2024-03-16")).toBe(false);
    });

    it("handles edge cases", () => {
      expect(areDatesEqual("", "")).toBe(true);
      expect(areDatesEqual("2024-03-15", "")).toBe(false);
    });
  });

  describe("getMillisUntilLocalMidnight", () => {
    it("returns positive milliseconds before midnight", () => {
      // 11pm - should be about 1 hour until midnight
      const evening = new Date(2024, 2, 15, 23, 0, 0, 0);
      const result = getMillisUntilLocalMidnight(evening);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(60 * 60 * 1000); // Max 1 hour
    });

    it("returns approximately 24 hours just after midnight", () => {
      // 12:01 AM - should be about 24 hours until next midnight
      const justAfterMidnight = new Date(2024, 2, 15, 0, 1, 0, 0);
      const result = getMillisUntilLocalMidnight(justAfterMidnight);
      expect(result).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(result).toBeLessThan(24 * 60 * 60 * 1000);
    });

    it("returns small value just before midnight", () => {
      // 11:59:59 PM - should be about 1 second
      const justBeforeMidnight = new Date(2024, 2, 15, 23, 59, 59, 0);
      const result = getMillisUntilLocalMidnight(justBeforeMidnight);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(2000); // Max 2 seconds
    });
  });
});
