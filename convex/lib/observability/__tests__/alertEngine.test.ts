import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STANDARD_ALERT_RULES, AlertEngine } from "../alertEngine";
import type { Notifier, AlertChannel } from "../alertEngine";
import type { Metrics } from "../metricsCollector";

const createMetrics = (): Metrics => ({
  poolHealth: {
    unusedEvents: 200,
    daysUntilDepletion: 33,
    coverageByEra: { ancient: 20, medieval: 60, modern: 120 },
    yearsReady: 100,
  },
  cost: {
    costToday: 0.5,
    cost7DayAvg: 0.5,
    cost30Day: 12,
    costPerEvent: 0.02,
  },
  quality: {
    avgQualityScore: 0.85,
    failureRate: 0.1,
    topFailureReasons: [],
    qualityTrend: [0.8, 0.82, 0.85],
  },
  latency: { p50: 100, p95: 250, p99: 500, avgDuration: 150 },
  timestamp: Date.now(),
});

const ruleNamed = (name: string) => {
  const rule = STANDARD_ALERT_RULES.find((candidate) => candidate.name === name);
  if (!rule) throw new Error(`Missing alert rule: ${name}`);
  return rule;
};

describe("standard alert boundaries", () => {
  it.each<[number, boolean]>([
    [0, true],
    [25, true],
    [30, false],
    [33, false],
  ])("checks pool depletion at %s days", (days, expected) => {
    const metrics = createMetrics();
    metrics.poolHealth.daysUntilDepletion = days;
    expect(ruleNamed("Pool Depletion Imminent").condition(metrics)).toBe(expected);
  });

  it.each<[number, boolean]>([
    [0.9, false],
    [1, false],
    [2, true],
  ])("checks cost spikes at $%s against a $0.50 average", (cost, expected) => {
    const metrics = createMetrics();
    metrics.cost.costToday = cost;
    expect(ruleNamed("Cost Spike Detected").condition(metrics)).toBe(expected);
  });

  it.each<[number, boolean]>([
    [0, true],
    [0.65, true],
    [0.7, false],
    [0.75, false],
  ])("checks quality degradation at score %s", (score, expected) => {
    const metrics = createMetrics();
    metrics.quality.avgQualityScore = score;
    expect(ruleNamed("Quality Degradation").condition(metrics)).toBe(expected);
  });

  it.each<[number, boolean]>([
    [0.3, false],
    [0.5, false],
    [0.6, true],
    [1, true],
  ])("checks generation failures at rate %s", (rate, expected) => {
    const metrics = createMetrics();
    metrics.quality.failureRate = rate;
    expect(ruleNamed("Generation Failure Spike").condition(metrics)).toBe(expected);
  });
});

describe("AlertEngine", () => {
  const logNotifier = vi.fn<Notifier>();
  const emailNotifier = vi.fn<Notifier>();
  let notifiers: Map<AlertChannel, Notifier>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-01T00:00:00Z"));
    logNotifier.mockReset().mockResolvedValue(undefined);
    emailNotifier.mockReset().mockResolvedValue(undefined);
    notifiers = new Map<AlertChannel, Notifier>();
    notifiers.set("log", logNotifier);
    notifiers.set("email", emailNotifier);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not deliver alerts for healthy metrics", async () => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    expect(await engine.checkAlerts(createMetrics())).toEqual([]);
    expect(logNotifier).not.toHaveBeenCalled();
    expect(emailNotifier).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "Pool Depletion Imminent",
      cooldown: 24 * 60 * 60 * 1000,
      trigger: (metrics: Metrics) => {
        metrics.poolHealth.daysUntilDepletion = 25;
      },
    },
    {
      name: "Cost Spike Detected",
      cooldown: 6 * 60 * 60 * 1000,
      trigger: (metrics: Metrics) => {
        metrics.cost.costToday = 2;
      },
    },
    {
      name: "Quality Degradation",
      cooldown: 12 * 60 * 60 * 1000,
      trigger: (metrics: Metrics) => {
        metrics.quality.avgQualityScore = 0.65;
      },
    },
    {
      name: "Generation Failure Spike",
      cooldown: 60 * 60 * 1000,
      trigger: (metrics: Metrics) => {
        metrics.quality.failureRate = 0.6;
      },
    },
  ])("suppresses $name until its exact cooldown boundary", async ({ name, cooldown, trigger }) => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    const metrics = createMetrics();
    trigger(metrics);

    expect(await engine.checkAlerts(metrics)).toEqual([name]);
    vi.advanceTimersByTime(cooldown - 1);
    expect(await engine.checkAlerts(metrics)).toEqual([]);
    expect(logNotifier).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(await engine.checkAlerts(metrics)).toEqual([name]);
    expect(logNotifier).toHaveBeenCalledTimes(2);
  });

  it("retains cooldown across recovery and relapse", async () => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    const metrics = createMetrics();
    metrics.poolHealth.daysUntilDepletion = 25;
    expect(await engine.checkAlerts(metrics)).toEqual(["Pool Depletion Imminent"]);

    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    metrics.poolHealth.daysUntilDepletion = 33;
    expect(await engine.checkAlerts(metrics)).toEqual([]);
    metrics.poolHealth.daysUntilDepletion = 25;
    expect(await engine.checkAlerts(metrics)).toEqual([]);
    expect(logNotifier).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(await engine.checkAlerts(metrics)).toEqual(["Pool Depletion Imminent"]);
    expect(logNotifier).toHaveBeenCalledTimes(2);
  });

  it("can deliver alerts again after a long idle interval", async () => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    const metrics = createMetrics();
    metrics.poolHealth.daysUntilDepletion = 25;
    expect(await engine.checkAlerts(metrics)).toEqual(["Pool Depletion Imminent"]);

    vi.advanceTimersByTime(48 * 60 * 60 * 1000 + 1000);
    expect(await engine.checkAlerts(metrics)).toEqual(["Pool Depletion Imminent"]);
    expect(logNotifier).toHaveBeenCalledTimes(2);
  });

  it("does not consume cooldown when notification delivery fails", async () => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    const metrics = createMetrics();
    metrics.cost.costToday = 2;
    const failure = new Error("Notification sink failed");
    logNotifier.mockRejectedValueOnce(failure);

    await expect(engine.checkAlerts(metrics)).rejects.toBe(failure);
    expect(await engine.checkAlerts(metrics)).toEqual(["Cost Spike Detected"]);
    expect(logNotifier).toHaveBeenCalledTimes(2);
  });

  it("resets only the requested rule cooldown", async () => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    const metrics = createMetrics();
    metrics.poolHealth.daysUntilDepletion = 25;
    metrics.cost.costToday = 2;
    expect(await engine.checkAlerts(metrics)).toEqual([
      "Pool Depletion Imminent",
      "Cost Spike Detected",
    ]);
    expect(await engine.checkAlerts(metrics)).toEqual([]);

    engine.resetCooldown("Pool Depletion Imminent");
    expect(await engine.checkAlerts(metrics)).toEqual(["Pool Depletion Imminent"]);
  });

  it("resets all rule cooldowns together", async () => {
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);
    const metrics = createMetrics();
    metrics.poolHealth.daysUntilDepletion = 25;
    metrics.quality.avgQualityScore = 0.4;
    metrics.quality.failureRate = 0.6;
    const expected = ["Pool Depletion Imminent", "Quality Degradation", "Generation Failure Spike"];
    expect(await engine.checkAlerts(metrics)).toEqual(expected);
    expect(await engine.checkAlerts(metrics)).toEqual([]);

    engine.resetAllCooldowns();
    expect(await engine.checkAlerts(metrics)).toEqual(expected);
  });
});
