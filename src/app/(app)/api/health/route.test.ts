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
    vi.unstubAllEnvs();
    mockQuery.mockResolvedValue("ok");
    mockGetConvexClient.mockReturnValue({ query: mockQuery });
  });

  it("reports backend readiness", async () => {
    vi.stubEnv("CHRONDLE_REVISION", "1234567890123456789012345678901234567890");
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.2.3");
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      service: "chrondle",
      revision: "1234567890123456789012345678901234567890",
      version: "1.2.3",
      checks: {
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
    expect(body.checks).toEqual({ convex: "unhealthy" });
  });
});
