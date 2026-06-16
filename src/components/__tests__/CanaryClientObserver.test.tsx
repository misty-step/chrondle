import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CanaryClientObserver } from "@/components/CanaryClientObserver";

const { mockCaptureClientException } = vi.hoisted(() => ({
  mockCaptureClientException: vi.fn(),
}));

vi.mock("@/observability/reporter", () => ({
  captureClientException: mockCaptureClientException,
}));

describe("CanaryClientObserver", () => {
  afterEach(() => {
    cleanup();
    delete window.ChrondleCanary;
    vi.clearAllMocks();
  });

  it("installs a manual smoke capture API", () => {
    render(<CanaryClientObserver />);

    window.ChrondleCanary?.captureMessage("browser canary smoke", { route: "/" });

    expect(mockCaptureClientException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        level: "info",
        tags: { source: "manual.smoke" },
        extras: { route: "/" },
      }),
    );
  });

  it("captures unhandled browser errors", () => {
    render(<CanaryClientObserver />);

    const error = new Error("client exploded");
    window.dispatchEvent(
      new ErrorEvent("error", {
        error,
        message: error.message,
        filename: "/app.js",
        lineno: 10,
        colno: 4,
      }),
    );

    expect(mockCaptureClientException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        level: "error",
        tags: { source: "window.error" },
        extras: expect.objectContaining({
          filename: "/app.js",
          lineno: 10,
          colno: 4,
        }),
      }),
    );
  });
});
