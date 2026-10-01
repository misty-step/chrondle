import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError } from "./instrumentation";

describe("instrumentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports request failures without including request headers", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await onRequestError(
      new Error("request failed"),
      {
        path: "/play",
        method: "GET",
        headers: {
          authorization: "private-authorization",
          cookie: "session=private-session",
        },
      },
      {
        routePath: "/play",
        routeType: "page",
      },
    );

    const report = String(consoleErrorSpy.mock.calls[0][1]);
    const payload = JSON.parse(report);
    expect(payload.message).toBe("request failed");
    expect(payload.context).toEqual({
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
    expect(report).not.toContain("private-authorization");
    expect(report).not.toContain("private-session");
  });
});
