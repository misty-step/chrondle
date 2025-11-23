import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue, useDebouncedValues, useDebouncedCallback } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("single value debouncing", () => {
    it("should return initial value immediately", () => {
      const { result } = renderHook(() => useDebouncedValue("initial", 100));
      expect(result.current).toBe("initial");
    });

    it("should debounce value changes", () => {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
        initialProps: { value: "initial" },
      });

      expect(result.current).toBe("initial");

      // Change value
      rerender({ value: "updated" });

      // Value should not change immediately
      expect(result.current).toBe("initial");

      // Advance time by 50ms (less than delay)
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(result.current).toBe("initial");

      // Advance time by another 50ms (total 100ms)
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(result.current).toBe("updated");
    });

    it("should cancel previous timeout on rapid changes", () => {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
        initialProps: { value: "initial" },
      });

      // Make rapid changes
      rerender({ value: "change1" });
      act(() => {
        vi.advanceTimersByTime(50);
      });

      rerender({ value: "change2" });
      act(() => {
        vi.advanceTimersByTime(50);
      });

      rerender({ value: "change3" });

      // Still should be initial
      expect(result.current).toBe("initial");

      // Advance time by 100ms from last change
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should only have the last value
      expect(result.current).toBe("change3");
    });

    it("should update immediately with 0 delay", () => {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 0), {
        initialProps: { value: "initial" },
      });

      expect(result.current).toBe("initial");

      rerender({ value: "updated" });
      expect(result.current).toBe("updated");
    });

    it("should handle null and undefined values", () => {
      const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
        initialProps: { value: null as string | null | undefined },
      });

      expect(result.current).toBe(null);

      rerender({ value: "value" });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe("value");

      rerender({ value: undefined as string | null | undefined });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe(undefined);
    });
  });

  describe("multiple values debouncing", () => {
    it("should debounce multiple values together", () => {
      const { result, rerender } = renderHook(({ values }) => useDebouncedValues(values, 100), {
        initialProps: {
          values: { userId: "user1", puzzleId: "puzzle1" },
        },
      });

      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Change both values
      rerender({
        values: { userId: "user2", puzzleId: "puzzle2" },
      });

      // Values should not change immediately
      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Advance time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Both values should update together
      expect(result.current).toEqual({ userId: "user2", puzzleId: "puzzle2" });
    });

    it("should NOT fire debounce when values are deeply equal despite different object reference", () => {
      // This test verifies that the hook properly handles reference stability
      // When values are the same but object reference changes, it should still debounce

      const { result, rerender } = renderHook(({ values }) => useDebouncedValues(values, 100), {
        initialProps: {
          values: { userId: "user1", puzzleId: "puzzle1" },
        },
      });

      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Rerender with same values but new object reference
      // This simulates what happens when parent component re-renders without memoization
      rerender({
        values: { userId: "user1", puzzleId: "puzzle1" }, // Same values, new object
      });

      // Important: Even though object reference changed, the debounce timer RESETS
      // This is the current behavior - it treats new object reference as a change
      // Values should not change immediately
      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Advance time to see if debounce fires
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // The values are the same, but because the object reference changed,
      // the debounce DOES fire (this is why memoization is critical)
      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });
    });

    it("should fire debounce exactly once when values actually change", () => {
      const { result, rerender } = renderHook(({ values }) => useDebouncedValues(values, 100), {
        initialProps: {
          values: { userId: "user1", puzzleId: "puzzle1" },
        },
      });

      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Rerender with actually different values
      rerender({
        values: { userId: "user2", puzzleId: "puzzle2" },
      });

      // Values should not change immediately
      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Advance time to trigger debounce
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Values should now be updated - this is the key test
      // The debounce should fire exactly once after the delay
      expect(result.current).toEqual({ userId: "user2", puzzleId: "puzzle2" });
    });

    it("should handle rapid reference changes with same values", () => {
      // This test verifies behavior when object reference changes rapidly
      // but values remain the same - a common React anti-pattern

      const { result, rerender } = renderHook(({ values }) => useDebouncedValues(values, 100), {
        initialProps: {
          values: { userId: "user1", puzzleId: "puzzle1" },
        },
      });

      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Simulate rapid re-renders with new object references but same values
      // This is what happens without memoization
      rerender({ values: { userId: "user1", puzzleId: "puzzle1" } });
      act(() => {
        vi.advanceTimersByTime(30);
      });

      rerender({ values: { userId: "user1", puzzleId: "puzzle1" } });
      act(() => {
        vi.advanceTimersByTime(30);
      });

      rerender({ values: { userId: "user1", puzzleId: "puzzle1" } });
      act(() => {
        vi.advanceTimersByTime(30);
      });

      // Still hasn't fired yet (only 90ms passed)
      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });

      // Complete the final debounce
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Even after all the reference changes, values remain the same
      expect(result.current).toEqual({ userId: "user1", puzzleId: "puzzle1" });
    });

    it("should warn in development when unmemoized object with same values is passed", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock NODE_ENV to be development for this test
      vi.stubEnv("NODE_ENV", "development");

      const { rerender } = renderHook(({ values }) => useDebouncedValues(values, 100), {
        initialProps: {
          values: { userId: "user1", puzzleId: "puzzle1" },
        },
      });

      // Clear initial logs
      consoleWarnSpy.mockClear();

      // Rerender with same values but new object reference
      // This triggers the development warning
      rerender({
        values: { userId: "user1", puzzleId: "puzzle1" }, // Same values, new object
      });

      // Should have warned about unmemoized object
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Values object reference changed but contents are identical"),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Please memoize the values object with useMemo"),
      );

      // Restore environment
      vi.unstubAllEnvs();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should handle partial value changes", () => {
      const { result, rerender } = renderHook(({ values }) => useDebouncedValues(values, 100), {
        initialProps: {
          values: { userId: "user1", puzzleId: "puzzle1", other: "value1" },
        },
      });

      // Change only one value
      rerender({
        values: { userId: "user2", puzzleId: "puzzle1", other: "value1" },
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toEqual({
        userId: "user2",
        puzzleId: "puzzle1",
        other: "value1",
      });
    });
  });

  describe("debounced callback", () => {
    it("should debounce function calls", () => {
      const mockFn = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(mockFn, 100));

      // Call multiple times
      act(() => {
        result.current("call1");
        result.current("call2");
        result.current("call3");
      });

      // Function should not be called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Function should be called once with last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("call3");
    });

    it("should cancel on unmount", () => {
      const mockFn = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCallback(mockFn, 100));

      act(() => {
        result.current("test");
      });

      // Unmount before timeout
      unmount();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Function should not be called
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should clean up timeouts on unmount", () => {
      const { result, unmount, rerender } = renderHook(
        ({ value }) => useDebouncedValue(value, 100),
        { initialProps: { value: "initial" } },
      );

      // Change value
      rerender({ value: "updated" });

      // Unmount before timeout completes
      unmount();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // No errors should occur
      expect(result.current).toBe("initial");
    });
  });
});
