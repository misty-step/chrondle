import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureServerException } = vi.hoisted(() => ({
  mockCaptureServerException: vi.fn(),
}));

const originalEnv = { ...process.env };

vi.mock("./observability/reporter", () => ({
  captureServerException: mockCaptureServerException,
}));

describe("instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("does not require SDK initialization", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    const { register } = await import("./instrumentation");

    await expect(register()).resolves.toBeUndefined();
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it("awaits Canary server exception capture before resolving", async () => {
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
