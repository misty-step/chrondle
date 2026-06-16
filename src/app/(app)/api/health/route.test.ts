import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConvexClient, mockQuery } = vi.hoisted(() => ({
  mockGetConvexClient: vi.fn(),
  mockQuery: vi.fn(),
}));

vi.mock("@/lib/convexServer", () => ({
  api: { health: { systemCheck: "health.systemCheck" } },
  getConvexClient: mockGetConvexClient,
}));

describe("/api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CANARY_API_KEY", "sk_live_server-canary-key-000000");
    mockQuery.mockResolvedValue("ok");
    mockGetConvexClient.mockReturnValue({ query: mockQuery });
  });

  it("reports Convex and Canary readiness", async () => {
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      service: "chrondle",
      checks: {
        canary: "configured",
        convex: "ok",
      },
    });
  });

  it("fails when the Canary write key is missing", async () => {
    vi.stubEnv("CANARY_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "");
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Missing Canary write key",
      checks: {
        canary: "missing",
        convex: "ok",
      },
    });
  });

  it("fails when the Canary write key is malformed", async () => {
    vi.stubEnv("CANARY_API_KEY", "KEY-test");
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "");
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Invalid Canary write key",
      checks: {
        canary: "invalid",
        convex: "ok",
      },
    });
  });

  it("reports Convex connectivity failures", async () => {
    mockQuery.mockRejectedValue(new Error("convex unavailable"));
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks).toEqual({ canary: "configured", convex: "unhealthy" });
  });
});
