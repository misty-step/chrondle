/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoadErrorRecovery } from "@/hooks/useLoadErrorRecovery";

describe("useLoadErrorRecovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-retries recoverable errors with backoff", async () => {
    const onRetry = vi.fn();
    renderHook(() =>
      useLoadErrorRecovery({
        error: "Failed to fetch puzzle due to network timeout",
        onRetry,
        maxAutoRetries: 1,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not auto-retry unrecoverable errors", async () => {
    const onRetry = vi.fn();
    renderHook(() =>
      useLoadErrorRecovery({
        error: "Puzzle #999 not found",
        onRetry,
        maxAutoRetries: 2,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onRetry).not.toHaveBeenCalled();
  });
});
