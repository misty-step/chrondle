/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAuthState } from "../useAuthState";
import * as clerk from "@clerk/nextjs";
import * as userCreationProvider from "@/components/UserCreationProvider";
import * as sentryClient from "@/observability/sentry.client";

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(),
}));

// Mock UserCreationProvider
vi.mock("@/components/UserCreationProvider", () => ({
  useUserCreation: vi.fn(),
}));

// Mock Sentry client
vi.mock("@/observability/sentry.client", () => ({
  captureClientException: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(clerk.useUser).mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    } as any);

    vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
      currentUser: null,
      userCreationLoading: false,
    } as any);
  });

  describe("loading state", () => {
    it("should return isLoading: true when Clerk not loaded", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: false,
        isSignedIn: false,
        user: null,
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.userId).toBeNull();
    });

    it("should return isLoading: true when userCreationLoading is true", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: { id: "clerk_123" },
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: null,
        userCreationLoading: true,
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("signed out state", () => {
    it("should return isAuthenticated: false, userId: null when not signed in", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: false,
        user: null,
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.userId).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return isAuthenticated: false when user object is null", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true, // Signed in but no user object
        user: null,
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.userId).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle user object with no ID", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: { id: "" }, // User exists but empty ID
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.userId).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle Clerk authenticated but Convex user missing", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: "clerk_123",
          primaryEmailAddress: { emailAddress: "test@example.com" },
        },
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: null, // Convex user not created yet
        userCreationLoading: false,
      } as any);

      const { result } = renderHook(() => useAuthState());

      // User is authenticated in Clerk but still "loading" from our perspective
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.userId).toBeNull();
    });

    it("should capture to Sentry when transitioning from loading to missing Convex user", () => {
      // Start with loading state (prevStateRef.current will have isLoading: true)
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: false,
        isSignedIn: false,
        user: null,
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: null,
        userCreationLoading: false,
      } as any);

      const { rerender } = renderHook(() => useAuthState());
      expect(sentryClient.captureClientException).not.toHaveBeenCalled();

      // Transition to Clerk authenticated but missing Convex user
      // Since prevStateRef.current has isLoading: true, this will capture to Sentry
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: "clerk_123",
          primaryEmailAddress: {
            emailAddress: "test@example.com",
            verification: { status: "verified" },
          },
          createdAt: new Date(),
        },
      } as any);

      rerender();

      // Should capture because previous state had isLoading: true
      expect(sentryClient.captureClientException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            error_type: "auth_user_not_found",
          }),
        }),
      );
    });
  });

  describe("authenticated state", () => {
    it("should return Convex user ID (not Clerk ID)", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: { id: "clerk_123" },
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: { _id: "convex_456" },
        userCreationLoading: false,
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.userId).toBe("convex_456");
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it("should return isAuthenticated: true, isLoading: false when fully authenticated", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: { id: "clerk_123" },
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: { _id: "convex_456" },
        userCreationLoading: false,
      } as any);

      const { result } = renderHook(() => useAuthState());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("state stability", () => {
    it("should return stable reference when deps unchanged (useMemo)", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: { id: "clerk_123" },
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: { _id: "convex_456" },
        userCreationLoading: false,
      } as any);

      const { result, rerender } = renderHook(() => useAuthState());

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // useMemo should return the same reference
      expect(firstResult).toBe(secondResult);
    });

    it("should return new reference when deps change", () => {
      vi.mocked(clerk.useUser).mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        user: { id: "clerk_123" },
      } as any);

      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: { _id: "convex_456" },
        userCreationLoading: false,
      } as any);

      const { result, rerender } = renderHook(() => useAuthState());

      const firstResult = result.current;

      // Change the Convex user
      vi.mocked(userCreationProvider.useUserCreation).mockReturnValue({
        currentUser: { _id: "convex_789" },
        userCreationLoading: false,
      } as any);

      rerender();
      const secondResult = result.current;

      expect(secondResult.userId).toBe("convex_789");
      // The reference should be different because deps changed
      expect(firstResult.userId).toBe("convex_456");
    });
  });
});
