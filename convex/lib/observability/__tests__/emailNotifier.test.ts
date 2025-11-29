import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, resetResendClient } from "../emailNotifier";
import type { AlertNotification } from "../alertEngine";
import type { Metrics } from "../metricsCollector";

// Mock Resend
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe("sendEmail", () => {
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
      topFailureReasons: [
        { reason: "Year too obscure", count: 5 },
        { reason: "Insufficient events", count: 3 },
      ],
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
      channels: ["email"],
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
    resetResendClient();
    // Set environment variables for tests
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_RECIPIENTS = "admin@example.com,ops@example.com";
  });

  afterEach(() => {
    resetResendClient();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_RECIPIENTS;
  });

  it("should initialize Resend on first call", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    expect(mockSend).toHaveBeenCalled();
  });

  it("should send email to configured recipients", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["admin@example.com", "ops@example.com"],
      }),
    );
  });

  it("should set correct subject line with severity", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "[CRITICAL] Pool Depletion Imminent",
      }),
    );
  });

  it("should include HTML body with alert details", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Pool Depletion Imminent");
    expect(call?.html).toContain("Test alert: Pool Depletion Imminent");
    expect(call?.html).toContain("Test alert message");
  });

  it("should include pool health metrics in HTML for pool alerts", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Pool Health Metrics");
    expect(call?.html).toContain("Unused Events");
    expect(call?.html).toContain("150");
    expect(call?.html).toContain("Days Until Depletion");
    expect(call?.html).toContain("25");
  });

  it("should include cost metrics in HTML for cost alerts", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Cost Spike Detected", "warning");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Cost Metrics");
    expect(call?.html).toContain("Cost Today");
    expect(call?.html).toContain("$2.00");
    expect(call?.html).toContain("7-Day Average");
    expect(call?.html).toContain("$0.50");
  });

  it("should include quality metrics in HTML for quality alerts", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Quality Degradation", "warning");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Quality Metrics");
    expect(call?.html).toContain("Average Quality Score");
    expect(call?.html).toContain("65.0%");
    expect(call?.html).toContain("Failure Rate");
    expect(call?.html).toContain("20.0%");
  });

  it("should include failure reasons in HTML for failure alerts", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Generation Failure Spike", "critical");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("Top Failure Reasons");
    expect(call?.html).toContain("Year too obscure");
    expect(call?.html).toContain("Insufficient events");
  });

  it("should apply correct CSS class for critical severity", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("alert-critical");
  });

  it("should apply correct CSS class for warning severity", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification = createMockNotification("Cost Spike Detected", "warning");

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain("alert-warning");
  });

  it("should handle missing API key gracefully", async () => {
    delete process.env.RESEND_API_KEY;
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendEmail(notification)).resolves.toBeUndefined();

    // Should not attempt to send
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should handle missing recipients gracefully", async () => {
    delete process.env.EMAIL_RECIPIENTS;
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendEmail(notification)).resolves.toBeUndefined();

    // Should not attempt to send
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should handle empty recipients gracefully", async () => {
    process.env.EMAIL_RECIPIENTS = "  ,  ,  ";
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendEmail(notification)).resolves.toBeUndefined();

    // Should not attempt to send
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should parse comma-separated recipients correctly", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    process.env.EMAIL_RECIPIENTS = " admin@test.com , ops@test.com , dev@test.com ";
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    await sendEmail(notification);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["admin@test.com", "ops@test.com", "dev@test.com"],
      }),
    );
  });

  it("should handle Resend API errors gracefully", async () => {
    mockSend.mockResolvedValue({ data: null, error: new Error("API error") });
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendEmail(notification)).resolves.toBeUndefined();
  });

  it("should handle send exceptions gracefully", async () => {
    mockSend.mockRejectedValue(new Error("Network error"));
    const notification = createMockNotification("Pool Depletion Imminent", "critical");

    // Should not throw
    await expect(sendEmail(notification)).resolves.toBeUndefined();
  });

  it("should only initialize Resend once", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const notification1 = createMockNotification("Pool Depletion Imminent", "critical");
    const notification2 = createMockNotification("Cost Spike Detected", "warning");

    await sendEmail(notification1);
    await sendEmail(notification2);

    // Both should succeed, but Resend constructor called only once
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("should include timestamp in email", async () => {
    mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    const timestamp = Date.now();
    const notification = createMockNotification("Pool Depletion Imminent", "critical");
    notification.timestamp = timestamp;

    await sendEmail(notification);

    const call = mockSend.mock.calls[0]?.[0];
    expect(call?.html).toContain(new Date(timestamp).toISOString());
  });
});
