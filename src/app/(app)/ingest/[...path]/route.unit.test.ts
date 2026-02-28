import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "./route";

const mockFetch = vi.fn<typeof fetch>();
const originalFetch = global.fetch;

describe("PostHog ingest proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("strips cookie and authorization headers before forwarding", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));

    const request = new NextRequest("https://www.chrondle.app/ingest/batch?ip=1", {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        cookie: "__session=abc",
        "content-type": "application/json",
        "x-client": "chrondle",
      },
      body: JSON.stringify({ event: "test" }),
    });

    await POST(request);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    const headers = init?.headers as Headers;

    expect(String(url)).toBe("https://us.i.posthog.com/batch?ip=1");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-client")).toBe("chrondle");
  });

  it("routes static assets to the PostHog assets host", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

    const request = new NextRequest("https://www.chrondle.app/ingest/static/app.js?v=1", {
      method: "GET",
    });

    await GET(request);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("https://us-assets.i.posthog.com/static/app.js?v=1");
  });

  it("routes decide endpoint to the PostHog main host", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

    const request = new NextRequest("https://www.chrondle.app/ingest/decide?v=3", {
      method: "GET",
    });

    await GET(request);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("https://us.i.posthog.com/decide?v=3");
  });

  it("strips set-cookie from upstream response headers", async () => {
    mockFetch.mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: {
          "cache-control": "max-age=30",
          "set-cookie": "ph_secret=1; HttpOnly",
        },
      }),
    );

    const request = new NextRequest("https://www.chrondle.app/ingest/batch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ event: "test" }),
    });

    const response = await POST(request);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("max-age=30");
  });
});
