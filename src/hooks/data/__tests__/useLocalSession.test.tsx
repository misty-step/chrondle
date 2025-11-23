import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalSession } from "../useLocalSession";
import * as localStorageSync from "@/lib/localStorageSync";

// Stable array references for mocking to avoid infinite loops
const EMPTY_ARRAY: number[] = [];
const MOCK_ARRAYS: { [key: string]: number[] } = {
  empty: EMPTY_ARRAY,
  twoGuesses: [1950, 1960],
  fiveGuesses: [1950, 1960, 1970, 1980, 1990],
  sixGuesses: [1950, 1960, 1970, 1980, 1990, 2000],
  oneGuess: [1950],
};

// Mock the localStorage sync utilities
vi.mock("@/lib/localStorageSync", () => ({
  subscribeToStorage: vi.fn(() => () => {}),
  getStorageSnapshot: vi.fn(() => MOCK_ARRAYS.empty),
  getServerSnapshot: vi.fn(() => MOCK_ARRAYS.empty),
  updateStorage: vi.fn(),
  clearStorage: vi.fn(),
}));

describe("useLocalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Anonymous Users (localStorage)", () => {
    it("should persist guesses to localStorage for anonymous users", () => {
      const { result } = renderHook(() => useLocalSession("puzzle-123", false, 1969));

      // Initially empty
      expect(result.current.sessionGuesses).toEqual([]);

      // Add a guess
      act(() => {
        result.current.addGuess(1950);
      });

      // Verify updateStorage was called
      expect(vi.mocked(localStorageSync.updateStorage)).toHaveBeenCalledWith(
        "puzzle-123",
        [1950],
        false,
        false,
      );
    });

    it("should read from localStorage via useSyncExternalStore", () => {
      // Mock existing guesses in storage
      vi.mocked(localStorageSync.getStorageSnapshot).mockReturnValue(MOCK_ARRAYS.twoGuesses);

      const { result } = renderHook(() => useLocalSession("puzzle-123", false));

      // Should read from localStorage
      expect(result.current.sessionGuesses).toEqual([1950, 1960]);
    });

    it("should mark game as complete when winning guess is made", () => {
      const { result } = renderHook(() => useLocalSession("puzzle-123", false, 1969));

      // Add the winning guess
      act(() => {
        result.current.addGuess(1969);
      });

      // Verify updateStorage was called with completion status
      expect(vi.mocked(localStorageSync.updateStorage)).toHaveBeenCalledWith(
        "puzzle-123",
        [1969],
        true, // isComplete
        true, // hasWon
      );
    });

    it("should mark game as complete after 6 guesses", () => {
      // Mock existing 5 guesses
      vi.mocked(localStorageSync.getStorageSnapshot).mockReturnValue(MOCK_ARRAYS.fiveGuesses);

      const { result } = renderHook(() => useLocalSession("puzzle-123", false, 1969));

      // Add 6th guess (not winning)
      act(() => {
        result.current.addGuess(2000);
      });

      // Verify updateStorage was called with completion status
      expect(vi.mocked(localStorageSync.updateStorage)).toHaveBeenCalledWith(
        "puzzle-123",
        [1950, 1960, 1970, 1980, 1990, 2000],
        true, // isComplete
        false, // hasWon (didn't guess correctly)
      );
    });

    it("should clear localStorage when clearGuesses is called", () => {
      const { result } = renderHook(() => useLocalSession("puzzle-123", false));

      act(() => {
        result.current.clearGuesses();
      });

      expect(vi.mocked(localStorageSync.clearStorage)).toHaveBeenCalledWith("puzzle-123");
    });
  });

  describe("Authenticated Users (React State)", () => {
    it("should use React state for authenticated users", () => {
      const { result } = renderHook(() => useLocalSession("puzzle-123", true, 1969));

      // Initially empty
      expect(result.current.sessionGuesses).toEqual([]);

      // Add a guess
      act(() => {
        result.current.addGuess(1950);
      });

      // Should not call localStorage functions
      expect(vi.mocked(localStorageSync.updateStorage)).not.toHaveBeenCalled();

      // State should be updated through React state
      expect(result.current.sessionGuesses).toEqual([1950]);

      // Add another guess
      act(() => {
        result.current.addGuess(1960);
      });

      // State should include both guesses
      expect(result.current.sessionGuesses).toEqual([1950, 1960]);
    });

    it("should reset authenticated state when puzzle changes", () => {
      const { result, rerender } = renderHook(({ puzzleId }) => useLocalSession(puzzleId, true), {
        initialProps: { puzzleId: "puzzle-123" },
      });

      // Add a guess
      act(() => {
        result.current.addGuess(1950);
      });

      // Change puzzle
      rerender({ puzzleId: "puzzle-456" });

      // State should be reset
      // Note: This tests the effect that resets state on puzzle change
      expect(result.current.sessionGuesses).toEqual([]);
    });
  });

  describe("Max Guesses Validation", () => {
    it("should not add more than 6 guesses for anonymous users", () => {
      // Mock 6 existing guesses
      vi.mocked(localStorageSync.getStorageSnapshot).mockReturnValue(MOCK_ARRAYS.sixGuesses);

      const { result } = renderHook(() => useLocalSession("puzzle-123", false));

      // Try to add 7th guess
      act(() => {
        result.current.addGuess(2010);
      });

      // Should not call updateStorage
      expect(vi.mocked(localStorageSync.updateStorage)).not.toHaveBeenCalled();
    });

    it("should not add duplicate guesses", () => {
      vi.mocked(localStorageSync.getStorageSnapshot).mockReturnValue(MOCK_ARRAYS.oneGuess);

      const { result } = renderHook(() => useLocalSession("puzzle-123", false));

      // Try to add duplicate
      act(() => {
        result.current.addGuess(1950);
      });

      // Should not call updateStorage
      expect(vi.mocked(localStorageSync.updateStorage)).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null puzzleId gracefully", () => {
      const { result } = renderHook(() => useLocalSession(null, false));

      // Should return empty guesses
      expect(result.current.sessionGuesses).toEqual([]);

      // Adding a guess should not crash
      act(() => {
        result.current.addGuess(1950);
      });

      // Should not call updateStorage
      expect(vi.mocked(localStorageSync.updateStorage)).not.toHaveBeenCalled();
    });

    it("should handle markComplete for anonymous users", () => {
      const { result } = renderHook(() => useLocalSession("puzzle-123", false));

      act(() => {
        result.current.markComplete(true);
      });

      expect(vi.mocked(localStorageSync.updateStorage)).toHaveBeenCalledWith(
        "puzzle-123",
        [],
        true,
        true,
      );
    });
  });
});
