import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getTimeUntilMidnight, formatCountdown } from "../displayFormatting";

// =============================================================================
// formatCountdown
// =============================================================================

describe("formatCountdown", () => {
  it("formats zero milliseconds", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
  });

  it("formats seconds only", () => {
    expect(formatCountdown(59000)).toBe("00:00:59");
    expect(formatCountdown(1000)).toBe("00:00:01");
    expect(formatCountdown(30000)).toBe("00:00:30");
  });

  it("formats minutes and seconds", () => {
    expect(formatCountdown(60000)).toBe("00:01:00");
    expect(formatCountdown(90000)).toBe("00:01:30");
    expect(formatCountdown(3599000)).toBe("00:59:59");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatCountdown(3600000)).toBe("01:00:00");
    expect(formatCountdown(3661000)).toBe("01:01:01");
    expect(formatCountdown(86399000)).toBe("23:59:59");
  });

  it("handles values over 24 hours", () => {
    expect(formatCountdown(86400000)).toBe("24:00:00");
    expect(formatCountdown(90000000)).toBe("25:00:00");
  });

  it("pads single digits with zeros", () => {
    expect(formatCountdown(1000)).toBe("00:00:01");
    expect(formatCountdown(61000)).toBe("00:01:01");
    expect(formatCountdown(3661000)).toBe("01:01:01");
  });

  it("handles exact hour boundaries", () => {
    expect(formatCountdown(7200000)).toBe("02:00:00"); // 2 hours
    expect(formatCountdown(10800000)).toBe("03:00:00"); // 3 hours
  });

  it("handles fractional seconds (truncates)", () => {
    expect(formatCountdown(1500)).toBe("00:00:01"); // 1.5 seconds -> 1
    expect(formatCountdown(999)).toBe("00:00:00"); // < 1 second -> 0
  });
});

// =============================================================================
// getTimeUntilMidnight
// =============================================================================

describe("getTimeUntilMidnight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns time until midnight from morning", () => {
    // Set time to 6:00 AM
    vi.setSystemTime(new Date("2025-01-15T06:00:00"));

    const result = getTimeUntilMidnight();

    // 18 hours until midnight = 18 * 60 * 60 * 1000 ms
    expect(result).toBe(18 * 60 * 60 * 1000);
  });

  it("returns time until midnight from evening", () => {
    // Set time to 11:00 PM
    vi.setSystemTime(new Date("2025-01-15T23:00:00"));

    const result = getTimeUntilMidnight();

    // 1 hour until midnight = 1 * 60 * 60 * 1000 ms
    expect(result).toBe(1 * 60 * 60 * 1000);
  });

  it("returns time until midnight from noon", () => {
    // Set time to 12:00 PM
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));

    const result = getTimeUntilMidnight();

    // 12 hours until midnight = 12 * 60 * 60 * 1000 ms
    expect(result).toBe(12 * 60 * 60 * 1000);
  });

  it("returns small value just before midnight", () => {
    // Set time to 11:59:59 PM
    vi.setSystemTime(new Date("2025-01-15T23:59:59"));

    const result = getTimeUntilMidnight();

    // Should be about 1 second (1000ms)
    expect(result).toBe(1000);
  });

  it("returns almost 24 hours just after midnight", () => {
    // Set time to 00:00:01 (1 second after midnight)
    vi.setSystemTime(new Date("2025-01-15T00:00:01"));

    const result = getTimeUntilMidnight();

    // Should be 23:59:59 = 86399000ms
    expect(result).toBe(86399000);
  });

  it("handles exactly midnight", () => {
    // Set time to exactly midnight
    vi.setSystemTime(new Date("2025-01-15T00:00:00"));

    const result = getTimeUntilMidnight();

    // Should be 24 hours = 86400000ms
    expect(result).toBe(86400000);
  });

  it("handles milliseconds precision", () => {
    // Set time with milliseconds
    vi.setSystemTime(new Date("2025-01-15T23:59:59.500"));

    const result = getTimeUntilMidnight();

    // Should be 500ms
    expect(result).toBe(500);
  });
});
