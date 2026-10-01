import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ClientErrorObserver } from "@/components/ClientErrorObserver";

describe("ClientErrorObserver", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("normalizes global failures and stops observing after unmount", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<ClientErrorObserver />);
    const browserError = new ErrorEvent("error", {
      message: "client exploded",
      filename: "/app.js",
      lineno: 10,
      colno: 4,
    });
    window.dispatchEvent(browserError);

    const errorReport = JSON.parse(String(consoleErrorSpy.mock.calls[0][1]));
    expect(errorReport.error_class).toBe("Error");
    expect(errorReport.message).toBe("client exploded");
    expect(errorReport.context).toEqual({
      tags: { source: "window.error" },
      extras: { filename: "/app.js", lineno: 10, colno: 4 },
    });

    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", { value: "request rejected" });
    window.dispatchEvent(rejection);

    const rejectionReport = JSON.parse(String(consoleErrorSpy.mock.calls[1][1]));
    expect(rejectionReport.error_class).toBe("Error");
    expect(rejectionReport.message).toBe("request rejected");
    expect(rejectionReport.context.tags).toEqual({ source: "window.unhandledrejection" });

    unmount();
    consoleErrorSpy.mockClear();
    window.dispatchEvent(browserError);
    window.dispatchEvent(rejection);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
