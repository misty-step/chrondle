import { afterEach, describe, expect, it, vi } from "vitest";
import { captureClientException } from "../reporter";

describe("error reporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("redacts compound credential fields without relying on recognized value shapes", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const credentials = {
      sessionToken: "opaque-session-fixture",
      privateKey: "opaque-private-fixture",
      "x-api-key": "opaque-api-fixture",
      bearerToken: "opaque-bearer-fixture",
      userPassword: "opaque-password-fixture",
    };

    captureClientException(new Error("Credential context failed"), {
      extras: { credentials, attemptCount: 2 },
    });

    const report = String(consoleErrorSpy.mock.calls[0][1]);
    const payload = JSON.parse(report);
    expect(payload.context.extras).toEqual({
      credentials: {
        sessionToken: "[REDACTED]",
        privateKey: "[REDACTED]",
        "x-api-key": "[REDACTED]",
        bearerToken: "[REDACTED]",
        userPassword: "[REDACTED]",
      },
      attemptCount: 2,
    });
    for (const value of Object.values(credentials)) {
      expect(report).not.toContain(value);
    }
    expect(credentials.sessionToken).toBe("opaque-session-fixture");
  });

  it("removes account identifiers and URL credentials, query and fragment", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    captureClientException(
      new Error("https://example.com/game?session=private-canary#fragment-canary"),
      {
        extras: {
          userId: "private-player",
          url: "https://name:password@example.com/game?x=private-canary#fragment-canary",
        },
      },
    );
    const report = String(output.mock.calls[0][1]);
    expect(JSON.parse(report).context.extras).toEqual({
      userId: "[REDACTED]",
      url: "https://example.com/game",
    });
    for (const canary of ["private-player", "password", "private-canary", "fragment-canary"]) {
      expect(report).not.toContain(canary);
    }
  });

  it("uses the native envelope transport with exact identity and survives sink rejection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@o1.ingest.sentry.io/1");
    vi.stubEnv("CHRONDLE_REVISION", "0123456789012345678901234567890123456789");
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("sink offline"))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.resetModules();
    const reporter = await import("../reporter");
    expect(reporter.captureClientException(new Error("offline error"))).toBeUndefined();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    reporter.captureClientException(new Error("recovered pat@example.com"), {
      tags: { source: "window.unhandledrejection" },
      extras: { sessionToken: "private-canary" },
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const options = fetch.mock.calls[1][1];
    const envelope = String(options.body);
    const event = JSON.parse(envelope.split("\n")[2]);
    expect(event.release).toBe("0123456789012345678901234567890123456789");
    expect(event.environment).toBe("test");
    expect(event.exception.values[0].mechanism.handled).toBe(false);
    expect(event.exception.values[0].value).toBe("recovered [EMAIL_REDACTED]");
    expect(event.extra.sessionToken).toBe("[REDACTED]");
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("breadcrumbs");
    expect(options.credentials).toBe("omit");
    expect(envelope).not.toContain("private-canary");
    expect(envelope).not.toContain("pat@example.com");
  });
});
