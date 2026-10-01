import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withObservability } from "../lib/observability";

describe("withObservability", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("CONVEX_ENV", "test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("preserves successful results without emitting failure logs or metrics", async () => {
    const wrapped = withObservability(
      async (_ctx: unknown, args: { value: number }) => args.value + 1,
      { name: "testFn" },
    );

    expect(await wrapped({}, { value: 41 })).toBe(42);
    expect(console.error).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it.each([
    ["Something broke", "unknown"],
    ["Invalid input detected", "validation"],
    ["Score verification failed", "validation"],
    ["Authentication required", "auth"],
    ["Forbidden", "auth"],
    ["Order puzzle not found", "not_found"],
  ])("classifies %s while rethrowing the original failure", async (message, reason) => {
    const error = new Error(message);
    const wrapped = withObservability(
      async () => {
        throw error;
      },
      { name: "testFn" },
    );

    await expect(wrapped({}, {})).rejects.toBe(error);

    const record = JSON.parse(String(vi.mocked(console.error).mock.calls[0][1]));
    expect(record.tags.reason).toBe(reason);
    expect(record.error).toContain(message);
    expect(console.info).toHaveBeenCalledWith(expect.any(String), {
      reason,
      function: "testFn",
    });
  });

  it("redacts secrets across error, tags and argument context without changing the failure", async () => {
    const privateKey = ["sk", "live", "123456789012345678901234"].join("_");
    const providerKey = ["sk-or-v1", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
    const error = new Error(`Provider failed with Bearer ${privateKey}`);
    const args = {
      token: "session-token-value",
      password: "password-value",
      provider: { failure: providerKey },
      year: 1066,
    };
    const wrapped = withObservability(
      async () => {
        throw error;
      },
      {
        name: "testFn",
        tags: { provider: privateKey },
      },
    );

    await expect(wrapped({}, args)).rejects.toBe(error);

    const payload = String(vi.mocked(console.error).mock.calls[0][1]);
    const record = JSON.parse(payload);
    expect(record.error).toContain("Bearer ***REDACTED***");
    expect(record.extras.message).toContain("Bearer ***REDACTED***");
    expect(record.tags.provider).toBe("sk_live_***REDACTED***");
    expect(record.extras.args.token).toBe("[REDACTED]");
    expect(record.extras.args.password).toBe("[REDACTED]");
    expect(record.extras.args.provider.failure).toBe("sk-or-v1-***REDACTED***");
    expect(record.extras.args.year).toBe(1066);
    for (const secret of [privateKey, providerKey, args.token, args.password]) {
      expect(payload).not.toContain(secret);
    }
    expect(args.token).toBe("session-token-value");
    expect(args.provider.failure).toBe(providerKey);
  });

  it("rethrows ignored errors without emitting failure logs or metrics", async () => {
    const error = new Error("Benign error");
    const wrapped = withObservability(
      async () => {
        throw error;
      },
      {
        name: "testFn",
        ignoreErrors: ["Benign"],
      },
    );

    await expect(wrapped({}, {})).rejects.toBe(error);
    expect(console.error).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
});
