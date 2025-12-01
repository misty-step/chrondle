import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STANDARD_ALERT_RULES, AlertEngine } from "../alertEngine";
import type { Notifier, AlertChannel } from "../alertEngine";
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

describe("AlertEngine integration smoke", () => {
  const sentryNotifier = vi.fn().mockResolvedValue(undefined);
  const emailNotifier = vi.fn().mockResolvedValue(undefined);

  const baseMetrics = (): Metrics => ({
    poolHealth: {
      unusedEvents: 4000,
      daysUntilDepletion: 120,
      coverageByEra: { ancient: 800, medieval: 1200, modern: 2000 },
      yearsReady: 2000,
    },
    cost: {
      costToday: 100,
      cost7DayAvg: 100,
      cost30Day: 3000,
      costPerEvent: 0.02,
    },
    quality: {
      avgQualityScore: 0.9,
      failureRate: 0.1,
      topFailureReasons: [],
      qualityTrend: [],
    },
    latency: {
      p50: 800,
      p95: 1500,
      p99: 2500,
      avgDuration: 900,
    },
    timestamp: Date.now(),
  });

  function createEngine() {
    return new AlertEngine(
      STANDARD_ALERT_RULES,
      new Map([
        ["sentry", sentryNotifier as unknown as Notifier],
        ["email", emailNotifier as unknown as Notifier],
      ]),
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-01T00:00:00Z"));
    sentryNotifier.mockClear();
    emailNotifier.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires pool depletion alert and routes to both channels", async () => {
    const metrics: Metrics = {
      ...baseMetrics(),
      poolHealth: { ...baseMetrics().poolHealth, daysUntilDepletion: 10, unusedEvents: 120 },
    };

    const engine = createEngine();
    const fired = await engine.checkAlerts(metrics);

    expect(fired).toContain("Pool Depletion Imminent");
    expect(sentryNotifier).toHaveBeenCalledTimes(1);
    expect(emailNotifier).toHaveBeenCalledTimes(1);
  });

  it("respects cost spike cooldown and re-fires after window", async () => {
    const metrics: Metrics = {
      ...baseMetrics(),
      cost: { ...baseMetrics().cost, costToday: 500, cost7DayAvg: 100 },
    };

    const engine = createEngine();

    const first = await engine.checkAlerts(metrics);
    expect(first).toContain("Cost Spike Detected");
    expect(sentryNotifier).toHaveBeenCalledTimes(1);

    const second = await engine.checkAlerts(metrics);
    expect(second).not.toContain("Cost Spike Detected");

    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);

    const third = await engine.checkAlerts(metrics);
    expect(third).toContain("Cost Spike Detected");
    expect(sentryNotifier).toHaveBeenCalledTimes(2);
  });
});

describe("AlertEngine", () => {
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

  let sentryNotifier: Notifier;
  let emailNotifier: Notifier;
  let notifiers: Map<AlertChannel, Notifier>;

  beforeEach(() => {
    sentryNotifier = vi.fn().mockResolvedValue(undefined);
    emailNotifier = vi.fn().mockResolvedValue(undefined);
    notifiers = new Map<AlertChannel, Notifier>([
      ["sentry", sentryNotifier],
      ["email", emailNotifier],
    ]);
  });

  describe("checkAlerts", () => {
    it("should fire alert when condition is met", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25, // Triggers "Pool Depletion Imminent"
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      const firedAlerts = await engine.checkAlerts(metrics);

      expect(firedAlerts).toContain("Pool Depletion Imminent");
      expect(sentryNotifier).toHaveBeenCalledTimes(1);
      expect(emailNotifier).toHaveBeenCalledTimes(1);
    });

    it("should not fire alert when condition is not met", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 200,
          daysUntilDepletion: 33, // Does not trigger
          coverageByEra: { ancient: 20, medieval: 60, modern: 120 },
          yearsReady: 100,
        },
      });

      const firedAlerts = await engine.checkAlerts(metrics);

      expect(firedAlerts).toHaveLength(0);
      expect(sentryNotifier).not.toHaveBeenCalled();
      expect(emailNotifier).not.toHaveBeenCalled();
    });

    it("should respect cooldown periods", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25,
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      // First check - should fire
      const firstFired = await engine.checkAlerts(metrics);
      expect(firstFired).toContain("Pool Depletion Imminent");
      expect(sentryNotifier).toHaveBeenCalledTimes(1);

      // Second check immediately after - should not fire (cooldown)
      const secondFired = await engine.checkAlerts(metrics);
      expect(secondFired).toHaveLength(0);
      expect(sentryNotifier).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should fire multiple alerts when multiple conditions are met", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25, // Triggers "Pool Depletion Imminent"
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
        quality: {
          avgQualityScore: 0.4, // Also triggers "Quality Degradation" (< 0.7)
          failureRate: 0.6, // Triggers "Generation Failure Spike"
          topFailureReasons: [{ reason: "Error", count: 5 }],
          qualityTrend: [0.5, 0.45, 0.4, 0.35, 0.4, 0.38, 0.4],
        },
      });

      const firedAlerts = await engine.checkAlerts(metrics);

      expect(firedAlerts).toHaveLength(3);
      expect(firedAlerts).toContain("Pool Depletion Imminent");
      expect(firedAlerts).toContain("Quality Degradation");
      expect(firedAlerts).toContain("Generation Failure Spike");
      expect(sentryNotifier).toHaveBeenCalledTimes(3);
      expect(emailNotifier).toHaveBeenCalledTimes(2); // Only critical alerts
    });

    it("should route alerts to correct channels", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        cost: {
          costToday: 2.0, // Triggers "Cost Spike Detected" (sentry only)
          cost7DayAvg: 0.5,
          cost30Day: 15.0,
          costPerEvent: 0.03,
        },
      });

      const firedAlerts = await engine.checkAlerts(metrics);

      expect(firedAlerts).toContain("Cost Spike Detected");
      expect(sentryNotifier).toHaveBeenCalledTimes(1);
      expect(emailNotifier).not.toHaveBeenCalled(); // Cost spike only goes to sentry
    });

    it("should include correct metrics in notification", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25,
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      await engine.checkAlerts(metrics);

      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            poolHealth: expect.objectContaining({
              daysUntilDepletion: 25,
              unusedEvents: 150,
            }),
          }),
          rule: expect.objectContaining({
            name: "Pool Depletion Imminent",
          }),
        }),
      );
    });

    it("should handle missing notifiers gracefully", async () => {
      const partialNotifiers = new Map<AlertChannel, Notifier>([["sentry", sentryNotifier]]);
      const engine = new AlertEngine(STANDARD_ALERT_RULES, partialNotifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25, // Triggers alert with both sentry and email
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      // Should not throw even though email notifier is missing
      const firedAlerts = await engine.checkAlerts(metrics);

      expect(firedAlerts).toContain("Pool Depletion Imminent");
      expect(sentryNotifier).toHaveBeenCalledTimes(1);
    });
  });

  describe("resetCooldown", () => {
    it("should allow alert to fire again after cooldown reset", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25,
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      // First check - should fire
      await engine.checkAlerts(metrics);
      expect(sentryNotifier).toHaveBeenCalledTimes(1);

      // Second check - should not fire (cooldown)
      await engine.checkAlerts(metrics);
      expect(sentryNotifier).toHaveBeenCalledTimes(1);

      // Reset cooldown
      engine.resetCooldown("Pool Depletion Imminent");

      // Third check - should fire again
      await engine.checkAlerts(metrics);
      expect(sentryNotifier).toHaveBeenCalledTimes(2);
    });
  });

  describe("resetAllCooldowns", () => {
    it("should allow all alerts to fire again after reset", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25, // Triggers "Pool Depletion Imminent"
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
        quality: {
          avgQualityScore: 0.4, // Also triggers "Quality Degradation" (< 0.7)
          failureRate: 0.6, // Triggers "Generation Failure Spike"
          topFailureReasons: [{ reason: "Error", count: 5 }],
          qualityTrend: [0.5, 0.45, 0.4, 0.35, 0.4, 0.38, 0.4],
        },
      });

      // First check - all three should fire
      await engine.checkAlerts(metrics);
      expect(sentryNotifier).toHaveBeenCalledTimes(3);

      // Second check - none should fire (cooldown)
      await engine.checkAlerts(metrics);
      expect(sentryNotifier).toHaveBeenCalledTimes(3);

      // Reset all cooldowns
      engine.resetAllCooldowns();

      // Third check - all three should fire again
      await engine.checkAlerts(metrics);
      expect(sentryNotifier).toHaveBeenCalledTimes(6);
    });
  });

  describe("generateAlertMessage", () => {
    it("should generate message for Pool Depletion alert", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        poolHealth: {
          unusedEvents: 150,
          daysUntilDepletion: 25,
          coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
          yearsReady: 75,
        },
      });

      await engine.checkAlerts(metrics);

      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Pool Depletion Imminent"),
        }),
      );
      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Days until depletion: 25"),
        }),
      );
      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Unused events: 150"),
        }),
      );
    });

    it("should generate message for Cost Spike alert", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        cost: {
          costToday: 2.0,
          cost7DayAvg: 0.5,
          cost30Day: 15.0,
          costPerEvent: 0.03,
        },
      });

      await engine.checkAlerts(metrics);

      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Cost Spike Detected"),
        }),
      );
      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Today's cost: $2.00"),
        }),
      );
    });

    it("should generate message for Quality Degradation alert", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.65,
          failureRate: 0.2,
          topFailureReasons: [],
          qualityTrend: [0.6, 0.62, 0.65, 0.67, 0.65, 0.63, 0.65],
        },
      });

      await engine.checkAlerts(metrics);

      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Quality Degradation"),
        }),
      );
      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Avg quality score: 65.0%"),
        }),
      );
    });

    it("should generate message for Failure Spike alert", async () => {
      const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
      const metrics = createMockMetrics({
        quality: {
          avgQualityScore: 0.4,
          failureRate: 0.6,
          topFailureReasons: [
            { reason: "Year too obscure", count: 5 },
            { reason: "Insufficient events", count: 3 },
          ],
          qualityTrend: [0.5, 0.45, 0.4, 0.35, 0.4, 0.38, 0.4],
        },
      });

      await engine.checkAlerts(metrics);

      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Generation Failure Spike"),
        }),
      );
      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Failure rate: 60.0%"),
        }),
      );
      expect(sentryNotifier).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Year too obscure"),
        }),
      );
    });
  });
});
