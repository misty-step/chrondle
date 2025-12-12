import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStreak } from "../useStreak";
import * as clerk from "@clerk/nextjs";
import * as convex from "convex/react";
import { anonymousStreakStorage } from "@/lib/secureStorage";

// Mock Clerk authentication
vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(),
}));

// Mock Convex queries and mutations
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock secureStorage
vi.mock("@/lib/secureStorage", () => ({
  anonymousStreakStorage: {
    get: vi.fn(() => ({ currentStreak: 0, lastCompletedDate: "" })),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

describe("useStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(clerk.useUser).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoaded: true,
    } as any);

    vi.mocked(convex.useQuery).mockReturnValue(null);
    vi.mocked(convex.useMutation).mockReturnValue(vi.fn() as any);

    // Reset localStorage
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Anonymous Users (localStorage)", () => {
    it("should return localStorage streak for anonymous users", () => {
      // Mock localStorage has a streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 5,
        lastCompletedDate: "2025-01-15",
      });

      const { result } = renderHook(() => useStreak());

      expect(result.current.streakData.currentStreak).toBe(5);
      expect(result.current.streakData.lastPlayedDate).toBe("2025-01-15");
      expect(result.current.streakData.longestStreak).toBe(5); // No history for anonymous
    });

    it("should persist updateStreak to localStorage for anonymous users", () => {
      // Mock empty localStorage
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 0,
        lastCompletedDate: "",
      });

      const { result } = renderHook(() => useStreak());

      // Mock today's date to ensure deterministic testing
      const mockToday = "2025-01-16";
      vi.spyOn(Date.prototype, "getUTCFullYear").mockReturnValue(2025);
      vi.spyOn(Date.prototype, "getUTCMonth").mockReturnValue(0); // January (0-indexed)
      vi.spyOn(Date.prototype, "getUTCDate").mockReturnValue(16);

      // Update streak after winning
      act(() => {
        result.current.updateStreak(true);
      });

      // Verify localStorage was updated
      expect(anonymousStreakStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStreak: 1,
          lastCompletedDate: mockToday,
        }),
      );
    });

    it("should preserve streak on page refresh for anonymous users", () => {
      // Mock localStorage with existing streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 10,
        lastCompletedDate: "2025-01-15",
      });

      // First render
      const { result: result1 } = renderHook(() => useStreak());
      expect(result1.current.streakData.currentStreak).toBe(10);

      // Simulate page refresh by re-rendering hook
      const { result: result2 } = renderHook(() => useStreak());
      expect(result2.current.streakData.currentStreak).toBe(10);
      expect(result2.current.streakData.lastPlayedDate).toBe("2025-01-15");
    });

    it("should reset streak to 0 when losing for anonymous users", () => {
      // Mock localStorage with existing streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 5,
        lastCompletedDate: "2025-01-15",
      });

      const { result } = renderHook(() => useStreak());

      // Mock today's date
      vi.spyOn(Date.prototype, "getUTCFullYear").mockReturnValue(2025);
      vi.spyOn(Date.prototype, "getUTCMonth").mockReturnValue(0);
      vi.spyOn(Date.prototype, "getUTCDate").mockReturnValue(16);

      // Update streak after losing
      act(() => {
        result.current.updateStreak(false);
      });

      // Verify streak was reset to 0
      expect(anonymousStreakStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStreak: 0,
          lastCompletedDate: "2025-01-16",
        }),
      );
    });

    it("should increment streak for consecutive day win", () => {
      // Mock Date to control current time
      const mockDate = new Date("2025-01-16T12:00:00Z");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      // Mock localStorage with yesterday's win
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 3,
        lastCompletedDate: "2025-01-15",
      });

      const { result } = renderHook(() => useStreak());

      // Update streak after winning
      act(() => {
        result.current.updateStreak(true);
      });

      // Verify streak was incremented
      expect(anonymousStreakStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStreak: 4,
          lastCompletedDate: "2025-01-16",
        }),
      );

      vi.useRealTimers();
    });
  });

  describe("Authenticated Users (Convex)", () => {
    beforeEach(() => {
      // Mock authenticated state
      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      // Mock Convex user data
      vi.mocked(convex.useQuery).mockReturnValue({
        _id: "convex_user_123",
        currentStreak: 7,
        longestStreak: 10,
        lastCompletedDate: "2025-01-15",
        totalPlays: 20,
      } as any);
    });

    it("should return Convex streak for authenticated users", () => {
      const { result } = renderHook(() => useStreak());

      expect(result.current.streakData.currentStreak).toBe(7);
      expect(result.current.streakData.longestStreak).toBe(10);
      expect(result.current.streakData.lastPlayedDate).toBe("2025-01-15");
      expect(result.current.streakData.totalGamesPlayed).toBe(20);
    });

    it("should make updateStreak a no-op for authenticated users (backend handles it)", () => {
      const { result } = renderHook(() => useStreak());

      // Update streak (should be no-op)
      act(() => {
        result.current.updateStreak(true);
      });

      // localStorage should NOT be updated
      expect(anonymousStreakStorage.set).not.toHaveBeenCalled();

      // Should return current Convex data
      expect(result.current.streakData.currentStreak).toBe(7);
    });

    it("should preserve streak on page refresh for authenticated users", () => {
      // First render
      const { result: result1 } = renderHook(() => useStreak());
      expect(result1.current.streakData.currentStreak).toBe(7);

      // Simulate page refresh
      const { result: result2 } = renderHook(() => useStreak());
      expect(result2.current.streakData.currentStreak).toBe(7);
      expect(result2.current.streakData.longestStreak).toBe(10);
    });
  });

  describe("Authentication Transition (Migration)", () => {
    it("should trigger mergeStreakMutation when transitioning from anonymous to authenticated", async () => {
      const mockMergeMutation = vi.fn(() =>
        Promise.resolve({
          mergedStreak: 8,
          source: "combined",
        }),
      );

      vi.mocked(convex.useMutation).mockReturnValue(mockMergeMutation as any);

      // Start as anonymous with a streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 5,
        lastCompletedDate: "2025-01-15",
      });

      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: false,
        user: null,
        isLoaded: true,
      } as any);

      const { rerender } = renderHook(() => useStreak());

      // Transition to authenticated
      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      vi.mocked(convex.useQuery).mockReturnValue({
        _id: "convex_user_123",
        currentStreak: 3,
        longestStreak: 5,
        lastCompletedDate: "2025-01-14",
      } as any);

      rerender();

      // Wait for migration to complete
      await waitFor(() => {
        expect(mockMergeMutation).toHaveBeenCalledWith({
          anonymousStreak: 5,
          anonymousLastCompletedDate: "2025-01-15",
        });
      });
    });

    it("should clear localStorage after successful migration", async () => {
      const mockMergeMutation = vi.fn(() =>
        Promise.resolve({
          mergedStreak: 8,
          source: "combined",
        }),
      );

      vi.mocked(convex.useMutation).mockReturnValue(mockMergeMutation as any);

      // Start as anonymous with a streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 5,
        lastCompletedDate: "2025-01-15",
      });

      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: false,
        user: null,
        isLoaded: true,
      } as any);

      const { rerender } = renderHook(() => useStreak());

      // Transition to authenticated
      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      vi.mocked(convex.useQuery).mockReturnValue({
        _id: "convex_user_123",
        currentStreak: 3,
        longestStreak: 5,
      } as any);

      rerender();

      // Wait for migration and cleanup
      await waitFor(() => {
        expect(anonymousStreakStorage.remove).toHaveBeenCalled();
      });
    });

    it("should NOT migrate if anonymous streak is 0", async () => {
      const mockMergeMutation = vi.fn();
      vi.mocked(convex.useMutation).mockReturnValue(mockMergeMutation as any);

      // Start as anonymous with NO streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 0,
        lastCompletedDate: "",
      });

      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: false,
        user: null,
        isLoaded: true,
      } as any);

      const { rerender } = renderHook(() => useStreak());

      // Transition to authenticated
      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      vi.mocked(convex.useQuery).mockReturnValue({
        _id: "convex_user_123",
        currentStreak: 0,
        longestStreak: 0,
      } as any);

      rerender();

      // Should NOT call migration
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockMergeMutation).not.toHaveBeenCalled();
    });

    it("should NOT migrate twice for the same session", async () => {
      const mockMergeMutation = vi.fn(() =>
        Promise.resolve({
          mergedStreak: 8,
          source: "combined",
        }),
      );

      vi.mocked(convex.useMutation).mockReturnValue(mockMergeMutation as any);

      // Start as anonymous with a streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 5,
        lastCompletedDate: "2025-01-15",
      });

      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      vi.mocked(convex.useQuery).mockReturnValue({
        _id: "convex_user_123",
        currentStreak: 3,
        longestStreak: 5,
      } as any);

      const { rerender } = renderHook(() => useStreak());

      // Wait for first migration
      await waitFor(() => {
        expect(mockMergeMutation).toHaveBeenCalledTimes(1);
      });

      // Trigger re-renders
      rerender();
      rerender();
      rerender();

      // Should still only be called once
      expect(mockMergeMutation).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing Convex user gracefully", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      // Convex query returns null (user not found)
      vi.mocked(convex.useQuery).mockReturnValue(null);

      const { result } = renderHook(() => useStreak());

      // Should fall back to anonymous data
      expect(result.current.streakData.currentStreak).toBe(0);
    });

    it("should handle empty lastCompletedDate for anonymous users", () => {
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 0,
        lastCompletedDate: "",
      });

      const { result } = renderHook(() => useStreak());

      expect(result.current.streakData.lastPlayedDate).toBe("");
    });

    it("should handle failed migration gracefully", async () => {
      const mockMergeMutation = vi.fn(() => Promise.reject(new Error("Network error")));

      vi.mocked(convex.useMutation).mockReturnValue(mockMergeMutation as any);

      // Start as anonymous with a streak
      vi.mocked(anonymousStreakStorage.get).mockReturnValue({
        currentStreak: 5,
        lastCompletedDate: "2025-01-15",
      });

      vi.mocked(clerk.useUser).mockReturnValue({
        isSignedIn: true,
        user: { id: "user_123" } as any,
        isLoaded: true,
      } as any);

      vi.mocked(convex.useQuery).mockReturnValue({
        _id: "convex_user_123",
        currentStreak: 3,
        longestStreak: 5,
      } as any);

      const { result } = renderHook(() => useStreak());

      // Wait for migration attempt
      await waitFor(() => {
        expect(mockMergeMutation).toHaveBeenCalled();
      });

      // Hook should not crash
      expect(result.current.streakData).toBeDefined();

      // localStorage should NOT be cleared after failed migration
      expect(anonymousStreakStorage.remove).not.toHaveBeenCalled();
    });
  });
});
