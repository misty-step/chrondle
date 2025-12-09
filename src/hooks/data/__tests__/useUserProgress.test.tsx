import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUserProgress } from "../useUserProgress";
import * as convexReact from "convex/react";
import * as validation from "@/lib/validation";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

// Mock validation module
vi.mock("@/lib/validation", () => ({
  safeConvexId: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useUserProgress", () => {
  const validUserId = "jh7k3n4m8p9q2r5s6t1u0v3w4x8y9z0a";
  const validPuzzleId = "ab7k3n4m8p9q2r5s6t1u0v3w4x8y9z0b";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: validation passes through the value
    vi.mocked(validation.safeConvexId).mockImplementation((id) => {
      if (id === null || id === undefined) return null;
      // Return the id if it looks valid (32 char alphanumeric)
      if (/^[a-z0-9]{32}$/.test(id)) return id as never;
      return null;
    });
  });

  describe("skipped queries", () => {
    it("should return null progress and no loading when userId is null", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useUserProgress(null, validPuzzleId));

      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return null progress and no loading when puzzleId is null", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useUserProgress(validUserId, null));

      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return null progress and no loading when both IDs are null", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useUserProgress(null, null));

      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return null progress when userId is invalid", () => {
      // Mock invalid userId
      vi.mocked(validation.safeConvexId).mockImplementation((id, type) => {
        if (type === "users") return null; // userId invalid
        if (type === "puzzles" && id) return id as never;
        return null;
      });

      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useUserProgress("invalid_clerk_id", validPuzzleId));

      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("loading state", () => {
    it("should return isLoading: true when query is in progress", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.progress).toBeNull();
    });
  });

  describe("no play record", () => {
    it("should return null progress when no play record exists", () => {
      vi.mocked(convexReact.useQuery).mockReturnValue(null);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.progress).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("successful data fetch", () => {
    it("should return normalized progress data", () => {
      const mockPlay = {
        _id: "play123" as never,
        userId: validUserId as never,
        puzzleId: validPuzzleId as never,
        guesses: [1960, 1970],
        ranges: [{ start: 1960, end: 1980, hintsUsed: 2, score: 75 }],
        totalScore: 75,
        completedAt: 1700000000000,
        updatedAt: 1700000000000,
      };

      vi.mocked(convexReact.useQuery).mockReturnValue(mockPlay);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.progress).toEqual({
        guesses: [1960, 1970],
        ranges: [{ start: 1960, end: 1980, hintsUsed: 2, score: 75 }],
        totalScore: 75,
        completedAt: 1700000000000,
      });
    });

    it("should normalize missing guesses to empty array", () => {
      const mockPlay = {
        _id: "play123" as never,
        userId: validUserId as never,
        puzzleId: validPuzzleId as never,
        guesses: undefined,
        ranges: [],
        totalScore: 0,
        updatedAt: 1700000000000,
      };

      vi.mocked(convexReact.useQuery).mockReturnValue(mockPlay);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.progress?.guesses).toEqual([]);
    });

    it("should normalize missing ranges to empty array", () => {
      const mockPlay = {
        _id: "play123" as never,
        userId: validUserId as never,
        puzzleId: validPuzzleId as never,
        guesses: [],
        ranges: undefined,
        totalScore: 0,
        updatedAt: 1700000000000,
      };

      vi.mocked(convexReact.useQuery).mockReturnValue(mockPlay);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.progress?.ranges).toEqual([]);
    });

    it("should normalize missing totalScore to 0", () => {
      const mockPlay = {
        _id: "play123" as never,
        userId: validUserId as never,
        puzzleId: validPuzzleId as never,
        guesses: [],
        ranges: [],
        totalScore: undefined,
        updatedAt: 1700000000000,
      };

      vi.mocked(convexReact.useQuery).mockReturnValue(mockPlay);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.progress?.totalScore).toBe(0);
    });

    it("should normalize missing completedAt to null", () => {
      const mockPlay = {
        _id: "play123" as never,
        userId: validUserId as never,
        puzzleId: validPuzzleId as never,
        guesses: [],
        ranges: [],
        totalScore: 0,
        completedAt: undefined,
        updatedAt: 1700000000000,
      };

      vi.mocked(convexReact.useQuery).mockReturnValue(mockPlay);

      const { result } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      expect(result.current.progress?.completedAt).toBeNull();
    });
  });

  describe("memoization", () => {
    it("should return stable reference when dependencies unchanged", () => {
      const mockPlay = {
        _id: "play123" as never,
        userId: validUserId as never,
        puzzleId: validPuzzleId as never,
        guesses: [1960],
        ranges: [],
        totalScore: 50,
        updatedAt: 1700000000000,
      };

      vi.mocked(convexReact.useQuery).mockReturnValue(mockPlay);

      const { result, rerender } = renderHook(() => useUserProgress(validUserId, validPuzzleId));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // useMemo should return same reference
      expect(firstResult).toBe(secondResult);
    });
  });
});
