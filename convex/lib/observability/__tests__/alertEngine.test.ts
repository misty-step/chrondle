import { describe, it, expect } from "vitest";
import { STANDARD_ALERT_RULES } from "../alertEngine";
import type { Metrics } from "../metricsCollector";

describe("STANDARD_ALERT_RULES", () => {
  const createMockMetrics = (overrides?: Partial<Metrics>): Metrics => ({
    poolHealth: {
      unusedEvents: 200,
      daysUntilDepletion: 33,
      coverageByEra: { ancient: 20, medieval: 60, modern: 120 },
      yearsReady: 100,
    },
    cost: {
      costToday: 0.5,
      cost7DayAvg: 0.45,
      cost30Day: 12.0,
      costPerEvent: 0.02,
    },
    quality: {
      avgQualityScore: 0.85,
      failureRate: 0.1,
      topFailureReasons: [],
      qualityTrend: [0.8, 0.82, 0.85, 0.87, 0.85, 0.83, 0.85],
    },
    latency: {
      p50: 0,
      p95: 0,
      p99: 0,
      avgDuration: 0,
    },
    timestamp: Date.now(),
    ...overrides,
  });

  describe("Pool Depletion Imminent", () => {
    const rule = STANDARD_ALERT_RULES.find((r) => r.name === "Pool Depletion Imminent");

    it("should exist and have correct configuration", () => {
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe("critical");
      expect(rule?.channels).toContain("sentry");
      expect(rule?.channels).toContain("email");
      expect(rule?.cooldown).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it("should fire when days until depletion < 30", () => {
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25,
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });

    it("should not fire when days until depletion >= 30", () => {
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 200,
          daysUntilDepletion: 33,
          coverageByEra: { ancient: 20, medieval: 60, modern: 120 },
          yearsReady: 100,
        },
      });

      expect(rule?.condition(metrics)).toBe(false);
    });

    it("should fire when days until depletion is exactly 0 (depleted)", () => {
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 0,
          daysUntilDepletion: 0,
          coverageByEra: { ancient: 0, medieval: 0, modern: 0 },
          yearsReady: 0,
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });
  });

  describe("Cost Spike Detected", () => {
    const rule = STANDARD_ALERT_RULES.find((r) => r.name === "Cost Spike Detected");

    it("should exist and have correct configuration", () => {
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe("warning");
      expect(rule?.channels).toContain("sentry");
      expect(rule?.cooldown).toBe(6 * 60 * 60 * 1000); // 6 hours
    });

    it("should fire when today's cost > 2x 7-day average", () => {
      const metrics = createMockMetrics({
        cost: {
          costToday: 2.0, // More than 2x average
          cost7DayAvg: 0.5,
          cost30Day: 15.0,
          costPerEvent: 0.03,
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });

    it("should not fire when today's cost <= 2x 7-day average", () => {
      const metrics = createMockMetrics({
        cost: {
          costToday: 0.9, // Less than 2x average
          cost7DayAvg: 0.5,
          cost30Day: 15.0,
          costPerEvent: 0.03,
        },
      });

      expect(rule?.condition(metrics)).toBe(false);
    });

    it("should fire when cost is exactly 2x average", () => {
      const metrics = createMockMetrics({
        cost: {
          costToday: 1.0, // Exactly 2x average
          cost7DayAvg: 0.5,
          cost30Day: 15.0,
          costPerEvent: 0.03,
        },
      });

      expect(rule?.condition(metrics)).toBe(false);
    });
  });

  describe("Quality Degradation", () => {
    const rule = STANDARD_ALERT_RULES.find((r) => r.name === "Quality Degradation");

    it("should exist and have correct configuration", () => {
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe("warning");
      expect(rule?.channels).toContain("sentry");
      expect(rule?.cooldown).toBe(12 * 60 * 60 * 1000); // 12 hours
    });

    it("should fire when average quality score < 0.7", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.65,
          failureRate: 0.2,
          topFailureReasons: [],
          qualityTrend: [0.6, 0.62, 0.65, 0.67, 0.65, 0.63, 0.65],
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });

    it("should not fire when average quality score >= 0.7", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.75,
          failureRate: 0.15,
          topFailureReasons: [],
          qualityTrend: [0.7, 0.72, 0.75, 0.77, 0.75, 0.73, 0.75],
        },
      });

      expect(rule?.condition(metrics)).toBe(false);
    });

    it("should fire when quality score is 0", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0,
          failureRate: 1.0,
          topFailureReasons: [],
          qualityTrend: [],
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });
  });

  describe("Generation Failure Spike", () => {
    const rule = STANDARD_ALERT_RULES.find((r) => r.name === "Generation Failure Spike");

    it("should exist and have correct configuration", () => {
      expect(rule).toBeDefined();
      expect(rule?.severity).toBe("critical");
      expect(rule?.channels).toContain("sentry");
      expect(rule?.channels).toContain("email");
      expect(rule?.cooldown).toBe(1 * 60 * 60 * 1000); // 1 hour
    });

    it("should fire when failure rate > 0.5", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.4,
          failureRate: 0.6, // More than 50%
          topFailureReasons: [
            { reason: "Year too obscure", count: 5 },
            { reason: "Insufficient events", count: 3 },
          ],
          qualityTrend: [0.5, 0.45, 0.4, 0.35, 0.4, 0.38, 0.4],
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });

    it("should not fire when failure rate <= 0.5", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.7,
          failureRate: 0.3, // Less than 50%
          topFailureReasons: [],
          qualityTrend: [0.7, 0.72, 0.7, 0.68, 0.7, 0.69, 0.7],
        },
      });

      expect(rule?.condition(metrics)).toBe(false);
    });

    it("should not fire when failure rate is exactly 0.5", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.5,
          failureRate: 0.5, // Exactly 50%
          topFailureReasons: [],
          qualityTrend: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        },
      });

      expect(rule?.condition(metrics)).toBe(false);
    });

    it("should fire when all generations fail", () => {
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0,
          failureRate: 1.0, // 100% failure
          topFailureReasons: [{ reason: "System error", count: 10 }],
          qualityTrend: [0, 0, 0, 0, 0, 0, 0],
        },
      });

      expect(rule?.condition(metrics)).toBe(true);
    });
  });

  describe("All rules", () => {
    it("should have 4 standard rules defined", () => {
      expect(STANDARD_ALERT_RULES).toHaveLength(4);
    });

    it("should have unique names", () => {
      const names = STANDARD_ALERT_RULES.map((r) => r.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("should all have valid severity levels", () => {
      const validSeverities = ["critical", "warning", "info"];
      STANDARD_ALERT_RULES.forEach((rule) => {
        expect(validSeverities).toContain(rule.severity);
      });
    });

    it("should all have at least one channel", () => {
      STANDARD_ALERT_RULES.forEach((rule) => {
        expect(rule.channels.length).toBeGreaterThan(0);
      });
    });

    it("should all have positive cooldown periods", () => {
      STANDARD_ALERT_RULES.forEach((rule) => {
        expect(rule.cooldown).toBeGreaterThan(0);
      });
    });
  });
});
