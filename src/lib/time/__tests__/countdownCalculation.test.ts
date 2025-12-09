import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateCountdownTime,
  shouldTriggerCompletion,
  didCountdownRestart,
} from "../countdownCalculation";

// Mock the dependencies
vi.mock("@/lib/displayFormatting", () => ({
  formatCountdown: vi.fn((ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }),
  getTimeUntilMidnight: vi.fn(() => 7200000), // 2 hours
}));

describe("countdownCalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateCountdownTime", () => {
    const baseNow = 1704067200000; // 2024-01-01 00:00:00 UTC

    describe("with target timestamp", () => {
      it("calculates remaining time correctly", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow + 3600000, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("01:00:00");
        expect(result.remaining).toBe(3600000);
        expect(result.isComplete).toBe(false);
        expect(result.error).toBeNull();
      });

      it("handles exact target time (0 remaining)", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("00:00:00");
        expect(result.remaining).toBe(0);
        expect(result.isComplete).toBe(true);
      });

      it("handles past target time (negative remaining)", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow - 1000, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("00:00:00");
        expect(result.remaining).toBe(0);
        expect(result.isComplete).toBe(true);
      });

      it("formats multi-hour countdown", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow + 12 * 3600000 + 30 * 60000 + 45000, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("12:30:45");
        expect(result.remaining).toBe(12 * 3600000 + 30 * 60000 + 45000);
        expect(result.isComplete).toBe(false);
      });
    });

    describe("without target timestamp", () => {
      it("uses fallback when enabled", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: undefined, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("02:00:00"); // Mocked 2 hours
        expect(result.remaining).toBe(7200000);
        expect(result.isComplete).toBe(false);
        expect(result.error).toBe("Using local countdown - server timing unavailable");
      });

      it("returns error state when fallback disabled", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: undefined, enableFallback: false },
          baseNow,
        );

        expect(result.timeString).toBe("--:--:--");
        expect(result.remaining).toBe(0);
        expect(result.isComplete).toBe(false);
        expect(result.error).toBe("Countdown unavailable");
      });
    });

    describe("edge cases", () => {
      it("handles 1 second remaining", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow + 1000, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("00:00:01");
        expect(result.remaining).toBe(1000);
        expect(result.isComplete).toBe(false);
      });

      it("handles 999ms remaining (rounds to 0 seconds)", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow + 999, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("00:00:00");
        expect(result.remaining).toBe(999);
        expect(result.isComplete).toBe(false);
      });

      it("handles very large countdown (24+ hours)", () => {
        const result = calculateCountdownTime(
          { targetTimestamp: baseNow + 25 * 3600000, enableFallback: true },
          baseNow,
        );

        expect(result.timeString).toBe("25:00:00");
        expect(result.remaining).toBe(25 * 3600000);
        expect(result.isComplete).toBe(false);
      });
    });
  });

  describe("shouldTriggerCompletion", () => {
    it("returns true when newly complete", () => {
      const result = shouldTriggerCompletion(
        { timeString: "00:00:00", remaining: 0, isComplete: true, error: null },
        false,
      );
      expect(result).toBe(true);
    });

    it("returns false when already was complete", () => {
      const result = shouldTriggerCompletion(
        { timeString: "00:00:00", remaining: 0, isComplete: true, error: null },
        true,
      );
      expect(result).toBe(false);
    });

    it("returns false when not complete", () => {
      const result = shouldTriggerCompletion(
        { timeString: "01:00:00", remaining: 3600000, isComplete: false, error: null },
        false,
      );
      expect(result).toBe(false);
    });
  });

  describe("didCountdownRestart", () => {
    it("returns true when countdown restarted", () => {
      const result = didCountdownRestart(
        { timeString: "01:00:00", remaining: 3600000, isComplete: false, error: null },
        true,
      );
      expect(result).toBe(true);
    });

    it("returns false when still complete", () => {
      const result = didCountdownRestart(
        { timeString: "00:00:00", remaining: 0, isComplete: true, error: null },
        true,
      );
      expect(result).toBe(false);
    });

    it("returns false when was not complete", () => {
      const result = didCountdownRestart(
        { timeString: "00:30:00", remaining: 1800000, isComplete: false, error: null },
        false,
      );
      expect(result).toBe(false);
    });
  });
});
