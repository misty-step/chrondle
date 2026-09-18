import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("captureCanaryException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "sk_live_public-canary-key-000000");
    vi.stubEnv("NEXT_PUBLIC_CANARY_ENDPOINT", "https://canary.test/");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sanitizes values while preserving reusable structured context", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    const { captureCanaryException } = await import("../canary");
    const happenedAt = new Date("2026-03-27T12:34:56.000Z");
    const shared = { nestedEmail: "shared@example.com" };
    const extras: Record<string, unknown> = {
      email: "pat@example.com",
      happenedAt,
      attempt: BigInt(42),
      first: shared,
      second: shared,
    };
    extras.self = extras;

    await captureCanaryException(new Error("boom from pat@example.com"), {
      extras,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.message).toBe("boom from [EMAIL_REDACTED]");
    expect(payload.context.extras).toEqual({
      email: "[EMAIL_REDACTED]",
      happenedAt: happenedAt.toISOString(),
      attempt: "42",
      first: { nestedEmail: "[EMAIL_REDACTED]" },
      second: { nestedEmail: "[EMAIL_REDACTED]" },
      self: "[Circular]",
    });
  });

  it("skips reporting when the write key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "");
    vi.stubEnv("CANARY_API_KEY", "");

    const { captureCanaryException } = await import("../canary");
    await captureCanaryException(new Error("boom"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers the server-only write key when available", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubEnv("CANARY_API_KEY", "sk_live_server-canary-key-000000");
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "sk_live_public-canary-key-000000");

    const { captureCanaryException } = await import("../canary");
    await captureCanaryException(new Error("server boom"));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer sk_live_server-canary-key-000000",
      }),
    );
  });

  it("prefers the server-only endpoint when available", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubEnv("CANARY_ENDPOINT", "https://server-canary.test/");
    vi.stubEnv("NEXT_PUBLIC_CANARY_ENDPOINT", "https://public-canary.test/");

    const { captureCanaryException } = await import("../canary");
    await captureCanaryException(new Error("server endpoint boom"));

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://server-canary.test/api/v1/errors");
  });

  it("falls back to the stable canonical Canary endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubEnv("CANARY_ENDPOINT", "");
    vi.stubEnv("NEXT_PUBLIC_CANARY_ENDPOINT", "");

    const { captureCanaryException } = await import("../canary");
    await captureCanaryException(new Error("canonical endpoint probe"));

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://canary.mistystep.io/api/v1/errors");
  });
});
