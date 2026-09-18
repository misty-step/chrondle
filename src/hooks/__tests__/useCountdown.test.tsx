import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/displayFormatting", () => ({
  formatCountdown: () => "01:00:00",
  getTimeUntilMidnight: () => 3600000,
}));

vi.mock("@/lib/time/dailyDate", () => ({
  getMillisUntilLocalMidnight: () => 3600000,
}));

import { useCountdown } from "../useCountdown";

describe("useCountdown", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.setInterval = (() => 1) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => {}) as unknown as typeof clearInterval;
  });

  afterEach(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  it("never shows a loading state (local midnight is computed client-side)", () => {
    const { result, unmount } = renderHook(() => useCountdown());
    expect(result.current.isLoading).toBe(false);
    unmount();
  });

  it("counts down to the player's LOCAL midnight by default", () => {
    // getMillisUntilLocalMidnight (src/lib/time/dailyDate.ts) is the single
    // day-resolution source; the mocked 1h remaining renders via
    // formatCountdown.
    const { result, unmount } = renderHook(() => useCountdown());
    expect(result.current.timeString).toBe("01:00:00");
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("honors an explicit targetTimestamp override", () => {
    const { result, unmount } = renderHook(() =>
      useCountdown({ targetTimestamp: Date.now() + 60_000 }),
    );
    expect(result.current.timeString).toBe("01:00:00"); // formatCountdown mocked
    expect(result.current.isComplete).toBe(false);
    unmount();
  });

  it("reports completion when the target has passed", () => {
    const { result, unmount } = renderHook(() =>
      useCountdown({ targetTimestamp: Date.now() - 1000 }),
    );
    expect(result.current.isComplete).toBe(true);
    expect(result.current.timeString).toBe("00:00:00");
    unmount();
  });
});
