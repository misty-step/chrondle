import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const fetchMock = vi.fn();

describe("captureCanaryException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "sk_test_canary");
    vi.stubEnv("NEXT_PUBLIC_CANARY_ENDPOINT", "https://canary.test/");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubGlobal("fetch", fetchMock);
  });

  it("preserves dates while redacting strings and circular references", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    const { captureCanaryException } = await import("../canary");
    const happenedAt = new Date("2026-03-27T12:34:56.000Z");
    const extras: Record<string, unknown> = {
      email: "pat@example.com",
      happenedAt,
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
      self: "[Circular]",
    });
  });

  it("skips reporting when the write key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CANARY_API_KEY", "");

    const { captureCanaryException } = await import("../canary");
    await captureCanaryException(new Error("boom"));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
