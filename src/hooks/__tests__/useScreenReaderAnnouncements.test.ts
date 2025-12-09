import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScreenReaderAnnouncements } from "../useScreenReaderAnnouncements";
import type { RangeGuess } from "@/types/range";

// Helper to create RangeGuess with all required fields
function createRange(
  start: number,
  end: number,
  score: number,
  hintsUsed: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): RangeGuess {
  return { start, end, score, hintsUsed, timestamp: Date.now() };
}

// Mock formatYear to return predictable strings
vi.mock("@/lib/displayFormatting", () => ({
  formatYear: vi.fn((year: number) => `${year} AD`),
}));

describe("useScreenReaderAnnouncements", () => {
  let lastRangeCount: number;
  let setLastRangeCount: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    lastRangeCount = 0;
    setLastRangeCount = vi.fn((count: number) => {
      lastRangeCount = count;
    });
  });

  it("returns empty string initially with no ranges", () => {
    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges: [],
        lastRangeCount: 0,
        setLastRangeCount,
      }),
    );

    expect(result.current).toBe("");
    expect(setLastRangeCount).not.toHaveBeenCalled();
  });

  it("announces when a new range is added with score > 0", () => {
    const ranges: RangeGuess[] = [createRange(1960, 1970, 50, 1)];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 0,
        setLastRangeCount,
      }),
    );

    expect(result.current).toContain("Range 1960 AD to 1970 AD submitted");
    expect(result.current).toContain("Contained the target for 50 points");
    expect(setLastRangeCount).toHaveBeenCalledWith(1);
  });

  it("announces width when score is 0 (missed target)", () => {
    const ranges: RangeGuess[] = [createRange(1900, 1910, 0, 1)];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 0,
        setLastRangeCount,
      }),
    );

    expect(result.current).toContain("Missed the target");
    expect(result.current).toContain("Width 11 years");
    expect(setLastRangeCount).toHaveBeenCalledWith(1);
  });

  it("uses singular 'year' for width of 1", () => {
    const ranges: RangeGuess[] = [createRange(1969, 1969, 0, 0)];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 0,
        setLastRangeCount,
      }),
    );

    expect(result.current).toContain("Width 1 year.");
  });

  it("does not announce when lastRangeCount equals current count", () => {
    const ranges: RangeGuess[] = [createRange(1960, 1970, 50, 1)];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 1, // Already at 1
        setLastRangeCount,
      }),
    );

    expect(result.current).toBe("");
    expect(setLastRangeCount).not.toHaveBeenCalled();
  });

  it("does not announce when count decreases", () => {
    const ranges: RangeGuess[] = [];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 2, // Previous was higher
        setLastRangeCount,
      }),
    );

    expect(result.current).toBe("");
    expect(setLastRangeCount).not.toHaveBeenCalled();
  });

  it("announces only the latest range when multiple are added", () => {
    const ranges: RangeGuess[] = [createRange(1950, 1960, 30, 0), createRange(1965, 1975, 80, 2)];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 0,
        setLastRangeCount,
      }),
    );

    // Should announce the second (latest) range
    expect(result.current).toContain("1965 AD to 1975 AD");
    expect(result.current).toContain("80 points");
    expect(setLastRangeCount).toHaveBeenCalledWith(2);
  });

  it("updates announcement when ranges prop changes", () => {
    const initialRanges: RangeGuess[] = [createRange(1950, 1960, 30, 0)];

    const { result, rerender } = renderHook(
      ({ ranges, lastRangeCount }) =>
        useScreenReaderAnnouncements({
          ranges,
          lastRangeCount,
          setLastRangeCount,
        }),
      {
        initialProps: { ranges: initialRanges, lastRangeCount: 0 },
      },
    );

    expect(result.current).toContain("30 points");

    // Add another range
    const updatedRanges: RangeGuess[] = [...initialRanges, createRange(1970, 1980, 60, 1)];

    rerender({ ranges: updatedRanges, lastRangeCount: 1 });

    expect(result.current).toContain("60 points");
  });

  it("handles score being undefined (null coercion)", () => {
    // Create a range and then remove the score to simulate undefined
    const rangeWithUndefinedScore = createRange(1960, 1970, 0, 1);
    // @ts-expect-error - Intentionally setting score to undefined for edge case test
    rangeWithUndefinedScore.score = undefined;
    const ranges: RangeGuess[] = [rangeWithUndefinedScore];

    const { result } = renderHook(() =>
      useScreenReaderAnnouncements({
        ranges,
        lastRangeCount: 0,
        setLastRangeCount,
      }),
    );

    // Should treat undefined score as missed target
    expect(result.current).toContain("Missed the target");
  });
});
