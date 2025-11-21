import { describe, it, expect, vi, beforeEach } from "vitest";
import { withObservability } from "../lib/observability";

describe("withObservability", () => {
  const mockCtx = {};
  const mockFn = vi.fn();

  // Spies
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const _consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONVEX_ENV = "test";
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
