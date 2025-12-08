import { describe, it, expect } from "vitest";
import {
  AnimationPhase,
  calculateAnimationIntensity,
  getAnimationPhase,
  ANIMATION_CONFIG,
} from "../backgroundAnimation";

/**
 * Tests for backgroundAnimation module
 *
 * Pure functions for calculating animation intensity based on guess proximity.
 */

describe("backgroundAnimation", () => {
  describe("calculateAnimationIntensity", () => {
    it("returns 0 for empty guesses array", () => {
      expect(calculateAnimationIntensity([], 1969)).toBe(0);
    });

    it("returns 1.0 for exact match", () => {
      expect(calculateAnimationIntensity([1969], 1969)).toBe(1.0);
    });

    it("returns 1.0 when any guess is exact match", () => {
      expect(calculateAnimationIntensity([1950, 1960, 1969], 1969)).toBe(1.0);
    });

    describe("proximity thresholds", () => {
      it("within 5 years: returns 0.8-1.0 intensity", () => {
        const intensity = calculateAnimationIntensity([1967], 1969);
        expect(intensity).toBeGreaterThanOrEqual(0.8);
        expect(intensity).toBeLessThanOrEqual(1.0);
      });

      it("within 10 years: returns 0.6-0.8 intensity", () => {
        const intensity = calculateAnimationIntensity([1960], 1969);
        expect(intensity).toBeGreaterThanOrEqual(0.6);
        expect(intensity).toBeLessThanOrEqual(0.8);
      });

      it("within 25 years: returns 0.4-0.6 intensity", () => {
        const intensity = calculateAnimationIntensity([1950], 1969);
        expect(intensity).toBeGreaterThanOrEqual(0.4);
        expect(intensity).toBeLessThanOrEqual(0.6);
      });

      it("within 50 years: returns 0.2-0.4 intensity", () => {
        const intensity = calculateAnimationIntensity([1920], 1969);
        expect(intensity).toBeGreaterThanOrEqual(0.2);
        expect(intensity).toBeLessThanOrEqual(0.4);
      });

      it("within 100 years: returns 0.1-0.2 intensity", () => {
        const intensity = calculateAnimationIntensity([1880], 1969);
        expect(intensity).toBeGreaterThanOrEqual(0.1);
        expect(intensity).toBeLessThanOrEqual(0.2);
      });

      it("within 500 years: returns 0.0-0.1 intensity", () => {
        const intensity = calculateAnimationIntensity([1500], 1969);
        expect(intensity).toBeGreaterThanOrEqual(0.0);
        expect(intensity).toBeLessThanOrEqual(0.1);
      });

      it("beyond 500 years: returns 0.0 intensity", () => {
        expect(calculateAnimationIntensity([1000], 1969)).toBe(0.0);
      });
    });

    it("uses best (closest) guess for intensity", () => {
      // Multiple guesses, second one is closer
      const intensity = calculateAnimationIntensity([1920, 1968], 1969);
      // Should use 1968 (distance 1) not 1920 (distance 49)
      expect(intensity).toBeGreaterThan(0.8);
    });

    it("handles BC years (negative numbers)", () => {
      const intensity = calculateAnimationIntensity([-500], -495);
      expect(intensity).toBeGreaterThanOrEqual(0.8);
    });

    it("handles cross-BC/AD ranges", () => {
      // Guess of 10 AD for target of -10 BC (20 year difference)
      const intensity = calculateAnimationIntensity([10], -10);
      expect(intensity).toBeGreaterThanOrEqual(0.4);
      expect(intensity).toBeLessThanOrEqual(0.6);
    });
  });

  describe("getAnimationPhase", () => {
    it("returns Idle for intensity 0", () => {
      expect(getAnimationPhase(0)).toBe(AnimationPhase.Idle);
    });

    it("returns Subtle for intensity 0.1-0.2", () => {
      expect(getAnimationPhase(0.1)).toBe(AnimationPhase.Subtle);
      expect(getAnimationPhase(0.2)).toBe(AnimationPhase.Subtle);
    });

    it("returns Moderate for intensity 0.21-0.4", () => {
      expect(getAnimationPhase(0.21)).toBe(AnimationPhase.Moderate);
      expect(getAnimationPhase(0.4)).toBe(AnimationPhase.Moderate);
    });

    it("returns Intense for intensity 0.41-0.6", () => {
      expect(getAnimationPhase(0.41)).toBe(AnimationPhase.Intense);
      expect(getAnimationPhase(0.6)).toBe(AnimationPhase.Intense);
    });

    it("returns Climax for intensity > 0.6", () => {
      expect(getAnimationPhase(0.61)).toBe(AnimationPhase.Climax);
      expect(getAnimationPhase(0.8)).toBe(AnimationPhase.Climax);
      expect(getAnimationPhase(1.0)).toBe(AnimationPhase.Climax);
    });

    it("handles edge values correctly", () => {
      // Boundary conditions
      expect(getAnimationPhase(0.0)).toBe(AnimationPhase.Idle);
      expect(getAnimationPhase(0.2)).toBe(AnimationPhase.Subtle);
      expect(getAnimationPhase(0.4)).toBe(AnimationPhase.Moderate);
      expect(getAnimationPhase(0.6)).toBe(AnimationPhase.Intense);
    });
  });

  describe("AnimationPhase enum", () => {
    it("has correct string values", () => {
      expect(AnimationPhase.Idle).toBe("idle");
      expect(AnimationPhase.Subtle).toBe("subtle");
      expect(AnimationPhase.Moderate).toBe("moderate");
      expect(AnimationPhase.Intense).toBe("intense");
      expect(AnimationPhase.Climax).toBe("climax");
    });
  });

  describe("ANIMATION_CONFIG", () => {
    it("has duration for each phase", () => {
      expect(ANIMATION_CONFIG.DURATIONS[AnimationPhase.Idle]).toBe(0);
      expect(ANIMATION_CONFIG.DURATIONS[AnimationPhase.Subtle]).toBe(8);
      expect(ANIMATION_CONFIG.DURATIONS[AnimationPhase.Moderate]).toBe(6);
      expect(ANIMATION_CONFIG.DURATIONS[AnimationPhase.Intense]).toBe(4);
      expect(ANIMATION_CONFIG.DURATIONS[AnimationPhase.Climax]).toBe(2);
    });

    it("has opacity for each phase", () => {
      expect(ANIMATION_CONFIG.OPACITY[AnimationPhase.Idle]).toBe(0);
      expect(ANIMATION_CONFIG.OPACITY[AnimationPhase.Climax]).toBe(0.2);
    });

    it("has element count for each phase", () => {
      expect(ANIMATION_CONFIG.ELEMENT_COUNT[AnimationPhase.Idle]).toBe(0);
      expect(ANIMATION_CONFIG.ELEMENT_COUNT[AnimationPhase.Climax]).toBe(36);
    });
  });
});
