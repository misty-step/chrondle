import { describe, expect, it, vi } from "vitest";
import { calculateClosestGuess } from "../statistics";

// Mock logger to avoid side effects
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// =============================================================================
// calculateClosestGuess
// =============================================================================

describe("calculateClosestGuess", () => {
  // ===========================================================================
  // Invalid inputs (return null)
  // ===========================================================================

  describe("invalid inputs", () => {
    it("returns null for empty guesses array", () => {
      expect(calculateClosestGuess([], 1969)).toBeNull();
    });

    it("returns null for non-array guesses", () => {
      // @ts-expect-error - testing invalid input
      expect(calculateClosestGuess("not an array", 1969)).toBeNull();
      // @ts-expect-error - testing invalid input
      expect(calculateClosestGuess(null, 1969)).toBeNull();
      // @ts-expect-error - testing invalid input
      expect(calculateClosestGuess(undefined, 1969)).toBeNull();
    });

    it("returns null for non-number targetYear", () => {
      // @ts-expect-error - testing invalid input
      expect(calculateClosestGuess([1960, 1970], "1969")).toBeNull();
      // @ts-expect-error - testing invalid input
      expect(calculateClosestGuess([1960, 1970], null)).toBeNull();
      // @ts-expect-error - testing invalid input
      expect(calculateClosestGuess([1960, 1970], undefined)).toBeNull();
    });
  });

  // ===========================================================================
  // Single guess
  // ===========================================================================

  describe("single guess", () => {
    it("returns the only guess with correct distance", () => {
      const result = calculateClosestGuess([1960], 1969);

      expect(result).toEqual({ guess: 1960, distance: 9 });
    });

    it("returns distance 0 for exact match", () => {
      const result = calculateClosestGuess([1969], 1969);

      expect(result).toEqual({ guess: 1969, distance: 0 });
    });
  });

  // ===========================================================================
  // Multiple guesses
  // ===========================================================================

  describe("multiple guesses", () => {
    it("finds the closest guess from multiple options", () => {
      const result = calculateClosestGuess([1960, 1970, 1980], 1969);

      expect(result).toEqual({ guess: 1970, distance: 1 });
    });

    it("finds closest when first guess is closest", () => {
      const result = calculateClosestGuess([1968, 1950, 2000], 1969);

      expect(result).toEqual({ guess: 1968, distance: 1 });
    });

    it("finds closest when last guess is closest", () => {
      const result = calculateClosestGuess([1900, 1950, 1970], 1969);

      expect(result).toEqual({ guess: 1970, distance: 1 });
    });

    it("returns exact match when present", () => {
      const result = calculateClosestGuess([1900, 1969, 2000], 1969);

      expect(result).toEqual({ guess: 1969, distance: 0 });
    });

    it("returns first guess when multiple have same distance", () => {
      // 1968 and 1970 are both distance 1 from 1969
      const result = calculateClosestGuess([1968, 1970], 1969);

      expect(result).toEqual({ guess: 1968, distance: 1 });
    });
  });

  // ===========================================================================
  // Edge cases with non-finite numbers
  // ===========================================================================

  describe("non-finite numbers in guesses", () => {
    it("skips NaN values and finds valid closest", () => {
      const result = calculateClosestGuess([NaN, 1970, NaN], 1969);

      expect(result).toEqual({ guess: 1970, distance: 1 });
    });

    it("skips Infinity values and finds valid closest", () => {
      const result = calculateClosestGuess([Infinity, 1970, -Infinity], 1969);

      expect(result).toEqual({ guess: 1970, distance: 1 });
    });

    it("handles array with only non-finite values", () => {
      const result = calculateClosestGuess([NaN, Infinity, -Infinity], 1969);

      // First element is used as initial closestGuess but distance stays Infinity
      expect(result?.distance).toBe(Infinity);
    });
  });

  // ===========================================================================
  // Historical year ranges (BC/AD)
  // ===========================================================================

  describe("historical year ranges", () => {
    it("handles negative years (BC)", () => {
      const result = calculateClosestGuess([-500, -400, -300], -450);

      expect(result).toEqual({ guess: -500, distance: 50 });
    });

    it("handles mixed BC/AD years", () => {
      const result = calculateClosestGuess([-100, 0, 100], 50);

      expect(result).toEqual({ guess: 0, distance: 50 });
    });

    it("calculates correct distance across BC/AD boundary", () => {
      // -50 BC to 50 AD is 100 years apart
      const result = calculateClosestGuess([-50, 150], 50);

      expect(result).toEqual({ guess: -50, distance: 100 });
    });
  });

  // ===========================================================================
  // Large numbers and precision
  // ===========================================================================

  describe("large numbers", () => {
    it("handles very old dates", () => {
      const result = calculateClosestGuess([-3000, -2500, -2000], -2600);

      expect(result).toEqual({ guess: -2500, distance: 100 });
    });

    it("handles far future dates", () => {
      const result = calculateClosestGuess([3000, 3500, 4000], 3200);

      expect(result).toEqual({ guess: 3000, distance: 200 });
    });
  });
});
