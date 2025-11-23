import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePuzzleData } from "../usePuzzleData";

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn(() => Promise.resolve())),
}));

import { useQuery } from "convex/react";

describe("usePuzzleData Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Daily Puzzle Loading", () => {
    it("should load daily puzzle successfully", async () => {
      const mockPuzzle = {
        _id: "puzzle-1",
        targetYear: 1969,
        events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
        puzzleNumber: 1,
        createdAt: Date.now(),
      };

      vi.mocked(useQuery).mockReturnValue(mockPuzzle);

      const { result } = renderHook(() => usePuzzleData());

      expect(result.current.puzzle).toEqual({
        id: "puzzle-1",
        targetYear: 1969,
        events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
        puzzleNumber: 1,
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("should handle loading state", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => usePuzzleData());

      expect(result.current.puzzle).toBe(null);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it("should handle error state when puzzle is null", async () => {
      // Convex returns null when puzzle not found
      vi.mocked(useQuery).mockReturnValue(null);

      const { result } = renderHook(() => usePuzzleData());

      // The hook will trigger the mutation but we still get the error state
      expect(result.current.puzzle).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(new Error("No daily puzzle available"));
    });
  });

  describe("Archive Puzzle Loading", () => {
    it("should load archive puzzle with specific number", () => {
      const mockPuzzle = {
        _id: "puzzle-42",
        targetYear: 1776,
        events: ["Declaration signed", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
        puzzleNumber: 42,
        createdAt: Date.now(),
      };

      vi.mocked(useQuery).mockReturnValue(mockPuzzle);

      const { result } = renderHook(() => usePuzzleData(42));

      expect(result.current.puzzle).toEqual({
        id: "puzzle-42",
        targetYear: 1776,
        events: ["Declaration signed", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
        puzzleNumber: 42,
      });
    });

    it("should handle invalid puzzle number", () => {
      // The hook will still query but Convex returns null for invalid numbers
      vi.mocked(useQuery).mockReturnValue(null);

      const { result } = renderHook(() => usePuzzleData(-1));

      expect(result.current.puzzle).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(new Error("Puzzle #-1 not found"));
    });
  });

  describe("State Transitions", () => {
    it("should update when puzzle changes", async () => {
      const mockPuzzle1 = {
        _id: "puzzle-1",
        targetYear: 1969,
        events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
        puzzleNumber: 1,
        createdAt: Date.now(),
      };

      const mockPuzzle2 = {
        _id: "puzzle-2",
        targetYear: 1776,
        events: [
          "Different 1",
          "Different 2",
          "Different 3",
          "Different 4",
          "Different 5",
          "Different 6",
        ],
        puzzleNumber: 2,
        createdAt: Date.now(),
      };

      vi.mocked(useQuery).mockReturnValue(mockPuzzle1);

      const { result, rerender } = renderHook(({ puzzleNumber }) => usePuzzleData(puzzleNumber), {
        initialProps: { puzzleNumber: 1 },
      });

      expect(result.current.puzzle?.id).toBe("puzzle-1");

      vi.mocked(useQuery).mockReturnValue(mockPuzzle2);
      rerender({ puzzleNumber: 2 });

      expect(result.current.puzzle?.id).toBe("puzzle-2");
    });
  });

  describe("Stable References", () => {
    it("should maintain stable references when data doesn't change", () => {
      const mockPuzzle = {
        _id: "puzzle-1",
        targetYear: 1969,
        events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
        puzzleNumber: 1,
        createdAt: Date.now(),
      };

      vi.mocked(useQuery).mockReturnValue(mockPuzzle);

      const { result, rerender } = renderHook(() => usePuzzleData());

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // Should have same reference if data hasn't changed
      expect(firstResult).toBe(secondResult);
    });
  });
});
