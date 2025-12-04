import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isRetryableError,
  calculateBackoffDelay,
  sleep,
  DEFAULT_RETRY_CONFIG,
} from "../retryUtils";

describe("retryUtils", () => {
  // =============================================================================
  // isRetryableError
  // =============================================================================

  describe("isRetryableError", () => {
    it("returns true for network errors", () => {
      expect(isRetryableError(new Error("network error occurred"))).toBe(true);
      expect(isRetryableError(new Error("Network failure"))).toBe(true);
    });

    it("returns true for server errors", () => {
      expect(isRetryableError(new Error("server error 500"))).toBe(true);
      expect(isRetryableError(new Error("Internal Server Error"))).toBe(true);
    });

    it("returns true for timeout errors", () => {
      expect(isRetryableError(new Error("request timeout"))).toBe(true);
      expect(isRetryableError(new Error("Connection Timeout"))).toBe(true);
    });

    it("returns true for fetch errors", () => {
      expect(isRetryableError(new Error("fetch failed"))).toBe(true);
      expect(isRetryableError(new Error("Failed to fetch"))).toBe(true);
    });

    it("returns true for Convex errors", () => {
      expect(isRetryableError(new Error("convex connection lost"))).toBe(true);
      expect(isRetryableError(new Error("Convex error"))).toBe(true);
    });

    it("returns true for HTTP 5xx status codes", () => {
      expect(isRetryableError(new Error("HTTP 500"))).toBe(true);
      expect(isRetryableError(new Error("502 Bad Gateway"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
      expect(isRetryableError(new Error("504 Gateway Timeout"))).toBe(true);
    });

    it("returns true for request failed errors", () => {
      expect(isRetryableError(new Error("request failed"))).toBe(true);
      expect(isRetryableError(new Error("Request Failed with status"))).toBe(true);
    });

    it("returns false for non-retryable errors", () => {
      expect(isRetryableError(new Error("Invalid input"))).toBe(false);
      expect(isRetryableError(new Error("Unauthorized"))).toBe(false);
      expect(isRetryableError(new Error("Not found"))).toBe(false);
      expect(isRetryableError(new Error("Validation error"))).toBe(false);
      expect(isRetryableError(new Error("400 Bad Request"))).toBe(false);
    });

    it("is case insensitive", () => {
      expect(isRetryableError(new Error("NETWORK ERROR"))).toBe(true);
      expect(isRetryableError(new Error("SERVER ERROR"))).toBe(true);
      expect(isRetryableError(new Error("TIMEOUT"))).toBe(true);
    });
  });

  // =============================================================================
  // calculateBackoffDelay
  // =============================================================================

  describe("calculateBackoffDelay", () => {
    beforeEach(() => {
      // Mock Math.random to return predictable values
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns base delay for attempt 0 (with jitter)", () => {
      // With Math.random() = 0.5, jitter = 0.5 * 0.5 + 0.75 = 1.0
      const delay = calculateBackoffDelay(0, 1000, 4000);
      expect(delay).toBe(1000);
    });

    it("doubles delay for each subsequent attempt", () => {
      // Attempt 0: 1000 * 2^0 * 1.0 = 1000
      // Attempt 1: 1000 * 2^1 * 1.0 = 2000
      // Attempt 2: 1000 * 2^2 * 1.0 = 4000
      expect(calculateBackoffDelay(0, 1000, 10000)).toBe(1000);
      expect(calculateBackoffDelay(1, 1000, 10000)).toBe(2000);
      expect(calculateBackoffDelay(2, 1000, 10000)).toBe(4000);
    });

    it("caps delay at maxDelayMs", () => {
      // Attempt 3: 1000 * 2^3 = 8000, but capped at 4000
      const delay = calculateBackoffDelay(3, 1000, 4000);
      expect(delay).toBe(4000);
    });

    it("applies jitter correctly", () => {
      // Test with low jitter (Math.random = 0)
      vi.spyOn(Math, "random").mockReturnValue(0);
      // jitter = 0 * 0.5 + 0.75 = 0.75
      expect(calculateBackoffDelay(0, 1000, 4000)).toBe(750);

      // Test with high jitter (Math.random = 1)
      vi.spyOn(Math, "random").mockReturnValue(1);
      // jitter = 1 * 0.5 + 0.75 = 1.25
      expect(calculateBackoffDelay(0, 1000, 4000)).toBe(1250);
    });

    it("handles edge cases", () => {
      expect(calculateBackoffDelay(0, 0, 4000)).toBe(0);
      expect(calculateBackoffDelay(10, 1000, 1000)).toBe(1000); // Always capped
    });
  });

  // =============================================================================
  // sleep
  // =============================================================================

  describe("sleep", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("resolves after the specified delay", async () => {
      const promise = sleep(1000);
      let resolved = false;

      promise.then(() => {
        resolved = true;
      });

      // Not resolved yet
      expect(resolved).toBe(false);

      // Advance timers
      await vi.advanceTimersByTimeAsync(1000);

      expect(resolved).toBe(true);
    });

    it("resolves immediately for 0ms", async () => {
      const promise = sleep(0);
      await vi.advanceTimersByTimeAsync(0);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  // =============================================================================
  // DEFAULT_RETRY_CONFIG
  // =============================================================================

  describe("DEFAULT_RETRY_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(4000);
    });

    it("shouldRetry uses isRetryableError", () => {
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error("network error"))).toBe(true);
      expect(DEFAULT_RETRY_CONFIG.shouldRetry(new Error("invalid input"))).toBe(false);
    });

    it("onRetry is a function", () => {
      expect(typeof DEFAULT_RETRY_CONFIG.onRetry).toBe("function");
    });
  });
});
