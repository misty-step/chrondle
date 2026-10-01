import { afterEach, describe, expect, it, vi } from "vitest";
import { captureClientException } from "../reporter";

describe("error reporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitizes values while preserving reusable structured context", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const secretMaterial = "abcdefghijklmnopqrstuvwxyz123456";
    const platformKey = ["sk", "live", secretMaterial].join("_");
    const happenedAt = new Date("2026-03-27T12:34:56.000Z");
    const shared = { nestedEmail: "shared@example.com" };
    const extras: Record<string, unknown> = {
      email: "pat@example.com",
      password: "plain-password",
      credentials: { accessToken: "opaque-token", apiKey: platformKey },
      keyText: platformKey,
      happenedAt,
      attempt: BigInt(42),
      first: shared,
      second: shared,
      entries: [shared, ["pat@example.com"]],
    };
    extras.self = extras;
    const error = new Error(`boom from pat@example.com with Bearer ${platformKey}`);
    error.stack = `${error.message}\n  at run (/app.ts:1:1)`;

    captureClientException(error, {
      tags: { account: "pat@example.com" },
      extras,
    });

    const report = String(consoleErrorSpy.mock.calls[0][1]);
    const payload = JSON.parse(report);
    expect(payload.error_class).toBe("Error");
    expect(payload.message).toBe("boom from [EMAIL_REDACTED] with Bearer ***REDACTED***");
    expect(payload.stack_trace).toBe(
      "boom from [EMAIL_REDACTED] with Bearer ***REDACTED***\n  at run (/app.ts:1:1)",
    );
    expect(payload.context.tags).toEqual({ account: "[EMAIL_REDACTED]" });
    expect(payload.context.extras).toEqual({
      email: "[EMAIL_REDACTED]",
      password: "[REDACTED]",
      credentials: { accessToken: "[REDACTED]", apiKey: "[REDACTED]" },
      keyText: "sk_live_***REDACTED***",
      happenedAt: "2026-03-27T12:34:56.000Z",
      attempt: "42",
      first: { nestedEmail: "[EMAIL_REDACTED]" },
      second: { nestedEmail: "[EMAIL_REDACTED]" },
      entries: [{ nestedEmail: "[EMAIL_REDACTED]" }, ["[EMAIL_REDACTED]"]],
      self: "[Circular]",
    });
    expect(report).not.toContain(secretMaterial);
    expect(report).not.toContain("plain-password");
    expect(report).not.toContain("opaque-token");
    expect(extras.password).toBe("plain-password");
    expect(shared.nestedEmail).toBe("shared@example.com");
  });
});
