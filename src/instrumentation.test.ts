import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureServerException, mockInitSentryServer } = vi.hoisted(() => ({
  mockCaptureServerException: vi.fn(),
  mockInitSentryServer: vi.fn(),
}));

vi.mock("./observability/sentry.server", () => ({
  captureServerException: mockCaptureServerException,
  initSentryServer: mockInitSentryServer,
}));

describe("onRequestError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awaits server exception capture before resolving", async () => {
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
});
