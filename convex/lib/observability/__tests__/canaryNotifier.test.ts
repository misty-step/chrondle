import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendToCanary, resetCanaryNotifierState } from "../canaryNotifier";
import type { AlertNotification } from "../alertEngine";
import type { Metrics } from "../metricsCollector";

const fetchMock = vi.fn();

describe("sendToCanary", () => {
  const createMockMetrics = (): Metrics => ({
    poolHealth: {
      unusedEvents: 150,
      daysUntilDepletion: 25,
      coverageByEra: { ancient: 10, medieval: 30, modern: 110 },
      yearsReady: 75,
    },
    cost: {
      costToday: 2.0,
      cost7DayAvg: 0.5,
      cost30Day: 15.0,
      costPerEvent: 0.03,
    },
    quality: {
      avgQualityScore: 0.65,
      failureRate: 0.2,
      topFailureReasons: [{ reason: "Error", count: 5 }],
      qualityTrend: [0.6, 0.62, 0.65, 0.67, 0.65, 0.63, 0.65],
    },
    latency: {
      p50: 100,
      p95: 250,
      p99: 500,
      avgDuration: 150,
    },
    timestamp: Date.now(),
  });

  const createMockNotification = (
    ruleName: string,
    severity: "critical" | "warning" | "info",
  ): AlertNotification => ({
    rule: {
      name: ruleName,
      severity,
      channels: ["canary"],
      cooldown: 3600000,
      description: `Test alert: ${ruleName}`,
      condition: () => true,
    },
    metrics: createMockMetrics(),
    timestamp: Date.now(),
    message: `[${severity.toUpperCase()}] ${ruleName}\nTest alert message`,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetCanaryNotifierState();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CANARY_API_KEY", "sk_live_server-canary-key-000000");
    vi.stubEnv("CANARY_ENDPOINT", "https://canary.test/");
    fetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    resetCanaryNotifierState();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends alert notifications to Canary", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToCanary(notification);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(url).toBe("https://canary.test/api/v1/errors");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer sk_live_server-canary-key-000000",
        "Content-Type": "application/json",
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        service: "chrondle",
        error_class: "ChrondleAlert",
        message: notification.message,
        severity: "error",
      }),
    );
    expect(body.context.tags).toEqual(
      expect.objectContaining({
        alert_name: "Pool Depletion Imminent",
        metric_type: "pool_health",
      }),
    );
  });

  it("maps warning severity to Canary warning", async () => {
    const notification = createMockNotification("Cost Spike Detected", "warning");

    await sendToCanary(notification);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.severity).toBe("warning");
    expect(body.context.tags.metric_type).toBe("cost");
  });

  it("maps info severity to Canary info", async () => {
    const notification = createMockNotification("System Health Check", "info");

    await sendToCanary(notification);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.severity).toBe("info");
  });

  it("includes metrics and alert metadata in context extras", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToCanary(notification);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.context.extras).toEqual(
      expect.objectContaining({
        metrics: notification.metrics,
        alert_description: notification.rule.description,
        alert_channels: ["canary"],
      }),
    );
  });

  it("handles missing API key gracefully", async () => {
    vi.stubEnv("CANARY_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "");
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await expect(sendToCanary(notification)).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles Canary transport errors gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("Canary API error"));
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await expect(sendToCanary(notification)).resolves.toBeUndefined();
  });
});
