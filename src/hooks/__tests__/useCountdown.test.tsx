import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => null),
}));

vi.mock("convex/_generated/api", () => ({
  api: { puzzles: { getCronSchedule: "puzzles:getCronSchedule" } },
}));

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

import { useQuery } from "convex/react";
import { useCountdown } from "../useCountdown";

const mockedUseQuery = vi.mocked(useQuery);

describe("useCountdown", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.setInterval = (() => 1) as unknown as typeof setInterval;
    globalThis.clearInterval = (() => {}) as unknown as typeof clearInterval;
    mockedUseQuery.mockReturnValue(undefined);
  });

  afterEach(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  it("shows loading state with serverMidnight strategy", () => {
    // With serverMidnight strategy and no query result yet, should show loading
    const { result, unmount } = renderHook(() => useCountdown({ strategy: "serverMidnight" }));
    expect(result.current.isLoading).toBe(true);
    unmount();
  });

  it("never shows loading state with localMidnight strategy (default)", () => {
    // Local midnight is computed client-side, no server query needed
    const { result, unmount } = renderHook(() => useCountdown());
    expect(result.current.isLoading).toBe(false);
    unmount();
  });
});
