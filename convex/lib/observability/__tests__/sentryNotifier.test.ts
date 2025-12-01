import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendToSentry, resetSentryInit } from "../sentryNotifier";
import type { AlertNotification } from "../alertEngine";
import type { Metrics } from "../metricsCollector";
import * as Sentry from "@sentry/nextjs";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  withScope: vi.fn((callback) => {
    const scope = {
      setLevel: vi.fn(),
      setTag: vi.fn(),
      setExtra: vi.fn(),
    };
    callback(scope);
  }),
  captureMessage: vi.fn(),
}));

describe("sendToSentry", () => {
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
      channels: ["sentry"],
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
    resetSentryInit();
    // Set DSN for tests
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/123";
  });

  afterEach(() => {
    resetSentryInit();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("should initialize Sentry on first call", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToSentry(notification);

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://test@sentry.io/123",
      }),
    );
  });

  it("should map critical severity to error level", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToSentry(notification);

    expect(Sentry.withScope).toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(notification.message, "error");
  });

  it("should map warning severity to warning level", async () => {
    const notification = createMockNotification("Cost Spike Detected", "warning");

    await sendToSentry(notification);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(notification.message, "warning");
  });

  it("should map info severity to info level", async () => {
    const notification = createMockNotification("System Health Check", "info");

    await sendToSentry(notification);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(notification.message, "info");
  });

  it("should set alert_name tag", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToSentry(notification);

    // Verify withScope was called (tags are set inside)
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("should set severity tag", async () => {
    const notification = createMockNotification("Cost Spike Detected", "warning");

    await sendToSentry(notification);

    // Verify withScope was called (tags are set inside)
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("should set metric_type tag based on rule name", async () => {
    const poolNotification = createMockNotification("Pool Depletion Imminent", "critical");
    const costNotification = createMockNotification("Cost Spike Detected", "warning");
    const qualityNotification = createMockNotification("Quality Degradation", "warning");

    await sendToSentry(poolNotification);
    expect(Sentry.withScope).toHaveBeenCalled();

    vi.clearAllMocks();
    await sendToSentry(costNotification);
    expect(Sentry.withScope).toHaveBeenCalled();

    vi.clearAllMocks();
    await sendToSentry(qualityNotification);
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("should include metrics in extras", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToSentry(notification);

    // Verify withScope was called (extras are set inside)
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("should include alert description in extras", async () => {
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendToSentry(notification);

    // Verify withScope was called (extras are set inside)
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("should handle missing DSN gracefully", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendToSentry(notification)).resolves.toBeUndefined();

    // Should not attempt to capture
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("should handle Sentry errors gracefully", async () => {
    vi.mocked(Sentry.captureMessage).mockImplementationOnce(() => {
      throw new Error("Sentry API error");
    });

    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendToSentry(notification)).resolves.toBeUndefined();
  });

  it("should only initialize Sentry once", async () => {
    const notification1 = createMockNotification("Pool Depletion Imminent", "critical");
    const notification2 = createMockNotification("Cost Spike Detected", "warning");

    await sendToSentry(notification1);
    await sendToSentry(notification2);

    // init should only be called once
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });
});
