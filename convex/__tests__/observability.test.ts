import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withObservability } from "../lib/observability";

describe("withObservability", () => {
  const mockCtx = {};
  const mockFn = vi.fn();

  // Spies
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const _consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchSpy);
    process.env.CONVEX_ENV = "test";
    // Mock return of fetch to avoid unhandled promise rejections in background
    fetchSpy.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("executes function and returns result on success", async () => {
    mockFn.mockResolvedValue("success");
    const wrapped = withObservability(mockFn, { name: "testFn" });

    const result = await wrapped(mockCtx, { foo: "bar" });

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledWith(mockCtx, { foo: "bar" });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("captures and rethrows error", async () => {
    const error = new Error("Something broke");
    mockFn.mockRejectedValue(error);
    const wrapped = withObservability(mockFn, { name: "testFn" });

    await expect(wrapped(mockCtx, {})).rejects.toThrow("Something broke");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Sentry Capture]",
      expect.stringContaining("Something broke"),
    );
    // Check reason classification in JSON log
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Sentry Capture]",
      expect.stringContaining('"reason":"unknown"'),
    );
  });

  it("classifies validation errors", async () => {
    const error = new Error("Invalid input detected");
    mockFn.mockRejectedValue(error);
    const wrapped = withObservability(mockFn, { name: "testFn" });

    await expect(wrapped(mockCtx, {})).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Sentry Capture]",
      expect.stringContaining('"reason":"validation"'),
    );
  });

  it("sends slack alert if configured", async () => {
    process.env.ORDER_FAILURE_SLACK_WEBHOOK = "https://slack.com/webhook";
    const error = new Error("Boom");
    mockFn.mockRejectedValue(error);

    const wrapped = withObservability(mockFn, { name: "testFn", slack: true });

    await expect(wrapped(mockCtx, {})).rejects.toThrow();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://slack.com/webhook",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Boom"),
      }),
    );
  });

  it("ignores specified errors", async () => {
    const error = new Error("Benign error");
    mockFn.mockRejectedValue(error);
    const wrapped = withObservability(mockFn, {
      name: "testFn",
      ignoreErrors: ["Benign"],
    });

    await expect(wrapped(mockCtx, {})).rejects.toThrow("Benign error");

    // Should NOT capture
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
