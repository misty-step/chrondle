import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUserData } from "../useUserData";

// Mock dependencies
const mockUseUser = vi.fn();
const mockUseUserCreation = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@/components/UserCreationProvider", () => ({
  useUserCreation: () => mockUseUserCreation(),
}));

vi.mock("convex/_generated/api", () => ({
  api: { users: { getUserStats: "users:getUserStats" } },
}));

describe("useUserData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading states", () => {
    it("returns isLoading=true when Clerk is not loaded", () => {
      mockUseUser.mockReturnValue({ isLoaded: false, isSignedIn: false });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: false,
        currentUser: null,
      });
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useUserData());

      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading=true when user creation is loading", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: true,
        currentUser: null,
      });
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useUserData());

      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading=true when signed in but no user record", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: false,
        currentUser: null, // No user record yet
      });
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useUserData());

      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading=true when user is ready but stats are loading", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue(undefined); // Stats still loading

      const { result } = renderHook(() => useUserData());

      expect(result.current.isLoading).toBe(true);
    });

    it("returns isLoading=false when everything is loaded", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue({ totalPlays: 10, currentStreak: 5 });

      const { result } = renderHook(() => useUserData());

      expect(result.current.isLoading).toBe(false);
    });

    it("returns isLoading=false for signed out users after Clerk loads", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: false });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: false,
        currentUser: null,
      });
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useUserData());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSignedIn).toBe(false);
    });
  });

  describe("user stats", () => {
    it("returns userStats when loaded", () => {
      const mockStats = { totalPlays: 100, currentStreak: 7, longestStreak: 15 };
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue(mockStats);

      const { result } = renderHook(() => useUserData());

      expect(result.current.userStats).toEqual(mockStats);
    });

    it("returns undefined userStats when not loaded", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: true,
        currentUser: null,
      });
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useUserData());

      expect(result.current.userStats).toBeUndefined();
    });
  });

  describe("premium features (removed)", () => {
    it("always returns isPremium=false", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue({ totalPlays: 10 });

      const { result } = renderHook(() => useUserData());

      expect(result.current.isPremium).toBe(false);
    });

    it("always returns subscriptionEnd=undefined", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue({ totalPlays: 10 });

      const { result } = renderHook(() => useUserData());

      expect(result.current.subscriptionEnd).toBeUndefined();
    });
  });

  describe("query behavior", () => {
    it("skips query when user is not ready", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: false,
        currentUser: null,
      });
      mockUseQuery.mockReturnValue(undefined);

      renderHook(() => useUserData());

      // Query should be called with undefined (skip)
      expect(mockUseQuery).toHaveBeenCalledWith("users:getUserStats", undefined);
    });

    it("executes query when user is ready", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue({ totalPlays: 10 });

      renderHook(() => useUserData());

      // Query should be called with empty args (execute)
      expect(mockUseQuery).toHaveBeenCalledWith("users:getUserStats", {});
    });
  });

  describe("exposed state", () => {
    it("exposes userCreationLoading for debugging", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: false,
        userCreationLoading: true,
        currentUser: null,
      });
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useUserData());

      expect(result.current.userCreationLoading).toBe(true);
    });

    it("exposes isUserReady for debugging", () => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockUseUserCreation.mockReturnValue({
        isUserReady: true,
        userCreationLoading: false,
        currentUser: { _id: "user_123" },
      });
      mockUseQuery.mockReturnValue({ totalPlays: 10 });

      const { result } = renderHook(() => useUserData());

      expect(result.current.isUserReady).toBe(true);
    });
  });
});
