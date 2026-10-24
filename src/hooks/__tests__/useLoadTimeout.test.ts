import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLoadTimeout } from "../useLoadTimeout";

const TIMEOUT_MS = 1_000;

describe("useLoadTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never times out while not loading", () => {
    const { result } = renderHook(() => useLoadTimeout(false, TIMEOUT_MS));

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS * 2);
    });

    expect(result.current).toBe(false);
  });

  it("does not fire after unmount", () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = renderHook(() => useLoadTimeout(true, TIMEOUT_MS));
    const timerId = setTimeoutSpy.mock.results.at(-1)?.value;

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts the clock when loading stops and starts again", () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) => useLoadTimeout(isLoading, TIMEOUT_MS),
      { initialProps: { isLoading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS);
    });
    expect(result.current).toBe(true);

    // Loading ends (e.g. puzzle arrived), then starts again (e.g. date rollover)
    rerender({ isLoading: false });
    expect(result.current).toBe(false);
    rerender({ isLoading: true });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
