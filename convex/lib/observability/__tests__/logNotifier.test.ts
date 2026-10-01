import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendToLog } from "../logNotifier";
import { AlertEngine, STANDARD_ALERT_RULES } from "../alertEngine";
import type { AlertNotification, AlertChannel, Notifier } from "../alertEngine";
import type { Metrics } from "../metricsCollector";

const createMetrics = (): Metrics => ({
  poolHealth: {
    unusedEvents: 150,
    daysUntilDepletion: 25,
    coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
    yearsReady: 75,
  },
  cost: { costToday: 2, cost7DayAvg: 0.5, cost30Day: 15, costPerEvent: 0.03 },
  quality: {
    avgQualityScore: 0.65,
    failureRate: 0.6,
    topFailureReasons: [{ reason: "Provider unavailable", count: 5 }],
    qualityTrend: [0.6, 0.62, 0.65],
  },
  latency: { p50: 100, p95: 250, p99: 500, avgDuration: 150 },
  timestamp: 1_764_547_200_000,
});

describe("Convex alert logging", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits structured logs for every breached rule while emailing only critical alerts", async () => {
    const emailNotifier = vi.fn<Notifier>().mockResolvedValue(undefined);
    const notifiers = new Map<AlertChannel, Notifier>();
    notifiers.set("log", sendToLog);
    notifiers.set("email", emailNotifier);
    const engine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);

    await engine.checkAlerts(createMetrics());

    const errorLogs = vi
      .mocked(console.error)
      .mock.calls.map((call) => JSON.parse(String(call[1])));
    const warningLogs = vi
      .mocked(console.warn)
      .mock.calls.map((call) => JSON.parse(String(call[1])));
    expect(errorLogs).toMatchObject([
      { rule: "Pool Depletion Imminent", severity: "critical" },
      { rule: "Generation Failure Spike", severity: "critical" },
    ]);
    expect(warningLogs).toMatchObject([
      { rule: "Cost Spike Detected", severity: "warning" },
      { rule: "Quality Degradation", severity: "warning" },
    ]);
    expect(emailNotifier.mock.calls.map(([notification]) => notification.rule.name)).toEqual([
      "Pool Depletion Imminent",
      "Generation Failure Spike",
    ]);
  });

  it("redacts credentials in alert text, metadata and nested metrics without mutating them", async () => {
    const privateKey = ["sk", "live", "123456789012345678901234"].join("_");
    const providerKey = ["sk-or-v1", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
    const metrics = createMetrics();
    metrics.quality.topFailureReasons = [
      { reason: `provider failed with ${providerKey}`, count: 1 },
    ];
    const notification: AlertNotification = {
      rule: {
        name: `Provider failure ${privateKey}`,
        severity: "warning",
        channels: ["log"],
        cooldown: 60_000,
        description: `Credential ${privateKey} rejected`,
        condition: () => true,
      },
      metrics,
      timestamp: metrics.timestamp,
      message: `provider failed with Bearer ${privateKey}`,
    };

    await sendToLog(notification);

    const payload = String(vi.mocked(console.warn).mock.calls[0][1]);
    const record = JSON.parse(payload);
    expect(record.message).toContain("Bearer ***REDACTED***");
    expect(record.rule).toContain("sk_live_***REDACTED***");
    expect(record.description).toContain("sk_live_***REDACTED***");
    expect(record.metrics.quality.topFailureReasons[0]).toEqual({
      reason: "provider failed with sk-or-v1-***REDACTED***",
      count: 1,
    });
    expect(record.metrics.cost.costToday).toBe(2);
    expect(payload).not.toContain(privateKey);
    expect(payload).not.toContain(providerKey);
    expect(metrics.quality.topFailureReasons[0].reason).toContain(providerKey);
    expect(notification.message).toContain(privateKey);
  });
});
