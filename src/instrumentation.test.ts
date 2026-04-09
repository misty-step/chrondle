import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureCanaryException, mockCaptureServerException, mockInitSentryServer } = vi.hoisted(
  () => ({
    mockCaptureCanaryException: vi.fn(),
    mockCaptureServerException: vi.fn(),
    mockInitSentryServer: vi.fn(),
  }),
);

const originalEnv = { ...process.env };

vi.mock("./observability/canary", () => ({
  captureCanaryException: mockCaptureCanaryException,
}));

vi.mock("./observability/sentry.server", () => ({
  captureServerException: mockCaptureServerException,
  initSentryServer: mockInitSentryServer,
}));

describe("instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("skips Sentry initialization when the DSN is missing", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const { register } = await import("./instrumentation");

    await register();

    expect(mockInitSentryServer).not.toHaveBeenCalled();
  });

  it("initializes Sentry on the Node.js runtime when the DSN is configured", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/123";

    const { register } = await import("./instrumentation");

    await register();

    expect(mockInitSentryServer).toHaveBeenCalledTimes(1);
  });

  it("awaits server exception capture before resolving when Sentry is configured", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://test@sentry.io/123";

    let resolveCapture: (() => void) | undefined;
    const error = new Error("request failed");

    mockCaptureServerException.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve;
        }),
    );

    const { onRequestError } = await import("./instrumentation");

    const pending = onRequestError(
      error,
      {
        path: "/play",
        method: "GET",
        headers: {},
      },
      {
        routePath: "/play",
        routeType: "page",
      },
    );

    await vi.dynamicImportSettled();

    expect(mockCaptureServerException).toHaveBeenCalledWith(error, {
      level: "error",
      tags: {
        source: "nextjs.onRequestError",
        route_type: "page",
      },
      extras: {
        path: "/play",
        method: "GET",
        routePath: "/play",
      },
    });

    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveCapture?.();
    await pending;

    expect(settled).toBe(true);
  });

  it("falls back to Canary request capture when Sentry is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    const error = new Error("request failed");
    const { onRequestError } = await import("./instrumentation");

    await onRequestError(
      error,
      {
        path: "/play",
        method: "GET",
        headers: {},
      },
      {
        routePath: "/play",
        routeType: "page",
      },
    );

    expect(mockCaptureServerException).not.toHaveBeenCalled();
    expect(mockCaptureCanaryException).toHaveBeenCalledWith(error, {
      level: "error",
      tags: {
        source: "nextjs.onRequestError",
        route_type: "page",
      },
      extras: {
        path: "/play",
        method: "GET",
        routePath: "/play",
      },
    });
  });
});
