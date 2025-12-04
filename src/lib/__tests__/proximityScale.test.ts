import { describe, expect, it } from "vitest";
import { computeProximityScale } from "../proximityScale";

// =============================================================================
// computeProximityScale
// =============================================================================

describe("computeProximityScale", () => {
  describe("basic range positioning", () => {
    it("computes 0-100% for full span when range covers entire axis", () => {
      const result = computeProximityScale({
        rangeStart: 1900,
        rangeEnd: 2000,
      });

      expect(result.rangeStartPct).toBe(0);
      expect(result.rangeEndPct).toBe(100);
      expect(result.axisStart).toBe(1900);
      expect(result.axisEnd).toBe(2000);
    });

    it("computes correct percentages for range subset", () => {
      const result = computeProximityScale({
        rangeStart: 1950,
        rangeEnd: 1960,
      });

      expect(result.rangeStartPct).toBe(0);
      expect(result.rangeEndPct).toBe(100);
      expect(result.axisStart).toBe(1950);
      expect(result.axisEnd).toBe(1960);
    });

    it("handles single year range (span = 1)", () => {
      const result = computeProximityScale({
        rangeStart: 1969,
        rangeEnd: 1969,
      });

      // With span clamped to 1, both should be 0%
      expect(result.rangeStartPct).toBe(0);
      expect(result.rangeEndPct).toBe(0);
    });
  });

  describe("with target year", () => {
    it("positions target within range correctly", () => {
      const result = computeProximityScale({
        rangeStart: 1960,
        rangeEnd: 1980,
        targetYear: 1970,
      });

      // Target at 50% between range
      expect(result.targetPct).toBe(50);
    });

    it("expands axis when target is before range", () => {
      const result = computeProximityScale({
        rangeStart: 1970,
        rangeEnd: 1980,
        targetYear: 1960,
      });

      // Axis should expand to include target
      expect(result.axisStart).toBe(1960);
      expect(result.axisEnd).toBe(1980);
      // Target at 0%, range starts at 50%
      expect(result.targetPct).toBe(0);
      expect(result.rangeStartPct).toBe(50);
    });

    it("expands axis when target is after range", () => {
      const result = computeProximityScale({
        rangeStart: 1960,
        rangeEnd: 1970,
        targetYear: 1980,
      });

      // Axis should expand to include target
      expect(result.axisStart).toBe(1960);
      expect(result.axisEnd).toBe(1980);
      // Target at 100%, range ends at 50%
      expect(result.targetPct).toBe(100);
      expect(result.rangeEndPct).toBe(50);
    });

    it("handles target exactly at range start", () => {
      const result = computeProximityScale({
        rangeStart: 1969,
        rangeEnd: 1979,
        targetYear: 1969,
      });

      expect(result.targetPct).toBe(0);
      expect(result.rangeStartPct).toBe(0);
    });

    it("handles target exactly at range end", () => {
      const result = computeProximityScale({
        rangeStart: 1969,
        rangeEnd: 1979,
        targetYear: 1979,
      });

      expect(result.targetPct).toBe(100);
      expect(result.rangeEndPct).toBe(100);
    });
  });

  describe("without target year", () => {
    it("returns null targetPct when no target", () => {
      const result = computeProximityScale({
        rangeStart: 1960,
        rangeEnd: 1980,
      });

      expect(result.targetPct).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles negative years (BC)", () => {
      const result = computeProximityScale({
        rangeStart: -500,
        rangeEnd: -400,
        targetYear: -450,
      });

      expect(result.axisStart).toBe(-500);
      expect(result.axisEnd).toBe(-400);
      expect(result.targetPct).toBe(50);
    });

    it("handles BC/AD boundary", () => {
      const result = computeProximityScale({
        rangeStart: -50,
        rangeEnd: 50,
        targetYear: 0,
      });

      expect(result.axisStart).toBe(-50);
      expect(result.axisEnd).toBe(50);
      expect(result.targetPct).toBe(50);
    });

    it("clamps percentages to 0-100 range", () => {
      // This shouldn't happen in practice, but test the clamp
      const result = computeProximityScale({
        rangeStart: 1950,
        rangeEnd: 2000,
        targetYear: 1960,
      });

      expect(result.rangeStartPct).toBeGreaterThanOrEqual(0);
      expect(result.rangeEndPct).toBeLessThanOrEqual(100);
    });

    it("handles inverted range (start > end) by swapping in min/max", () => {
      // The function uses Math.min/max, so this tests that behavior
      const result = computeProximityScale({
        rangeStart: 2000,
        rangeEnd: 1900,
        targetYear: 1950,
      });

      // rangeStart is 2000, normalizedStart = min(2000, 1950) = 1950
      // rangeEnd is 1900, normalizedEnd = max(1900, 1950) = 1950
      // So span = max(1, 1950 - 1950) = 1
      expect(result.axisStart).toBe(1950);
      expect(result.axisEnd).toBe(1950);
    });
  });
});
