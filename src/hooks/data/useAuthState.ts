"use client";

import { useMemo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useUserCreation } from "@/components/UserCreationProvider";
import { logger } from "@/lib/logger";
import { captureClientException } from "@/observability/sentry.client";

/**
 * Return type for the useAuthState hook
 */
interface UseAuthStateReturn {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Hook to provide stable authentication state with Convex database ID
 *
 * This hook wraps Clerk's useUser and integrates with UserCreationProvider
 * to return the Convex database ID instead of the Clerk external ID.
 * This ensures compatibility with Convex queries that expect database IDs.
 *
 * @returns Object containing Convex user ID, authentication status, and loading state
 *
 * @example
 * const { userId, isAuthenticated, isLoading } = useAuthState();
 *
 * if (isLoading) return <div>Loading auth...</div>;
 * if (isAuthenticated) return <div>Welcome user {userId}</div>;
 * return <div>Please sign in</div>;
 */
export function useAuthState(): UseAuthStateReturn {
  const { user, isLoaded, isSignedIn } = useUser();
  const { currentUser, userCreationLoading } = useUserCreation();
  const prevStateRef = useRef<UseAuthStateReturn | null>(null);

  // Memoize the return value to ensure stable references
  return useMemo<UseAuthStateReturn>(() => {
    // Handle loading state - Clerk not yet loaded OR user creation in progress
    if (!isLoaded || userCreationLoading) {
      const result: UseAuthStateReturn = {
        userId: null,
        isAuthenticated: false,
        isLoading: true,
      };

      // Development-only debug logging for state transitions
      if (process.env.NODE_ENV === "development") {
        if (!prevStateRef.current || prevStateRef.current.isLoading !== result.isLoading) {
          logger.debug("[useAuthState] Auth loading...", {
            clerkLoaded: isLoaded,
            userCreationLoading,
          });
        }
      }

      prevStateRef.current = result;
      return result;
    }

    // Handle signed out state
    if (!isSignedIn || !user) {
      const result: UseAuthStateReturn = {
        userId: null,
        isAuthenticated: false,
        isLoading: false,
      };

      // Development-only debug logging for state transitions
      if (process.env.NODE_ENV === "development") {
        if (
          !prevStateRef.current ||
          prevStateRef.current.isAuthenticated !== result.isAuthenticated
        ) {
          logger.debug("[useAuthState] User signed out");
        }
      }

      prevStateRef.current = result;
      return result;
    }

    // Handle edge case: user exists but no ID (defensive programming)
    if (!user.id) {
      const result: UseAuthStateReturn = {
        userId: null,
        isAuthenticated: false,
        isLoading: false,
      };

      // Development-only debug logging for edge case
      if (process.env.NODE_ENV === "development") {
        logger.warn("[useAuthState] Edge case: User object exists but no ID found", { user });
      }

      prevStateRef.current = result;
      return result;
    }

    // Handle authenticated state - need Convex user to be created
    if (!currentUser) {
      // User is authenticated in Clerk but Convex user doesn't exist yet
      // This is a transient state while user creation happens
      const result: UseAuthStateReturn = {
        userId: null,
        isAuthenticated: true, // User IS authenticated in Clerk, just waiting for Convex
        isLoading: true, // Still loading from our perspective
      };

      // Development-only debug logging
      if (process.env.NODE_ENV === "development") {
        logger.warn("[useAuthState] Clerk authenticated but Convex user not ready:", {
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          currentUser,
        });
      }

      // Production diagnostic: Capture to Sentry if this persists
      // If we've been in this state for multiple renders, something is wrong
      if (!prevStateRef.current || !prevStateRef.current.isLoading) {
        // First time hitting this state - start tracking
        prevStateRef.current = result;
        return result;
      }

      // Still in this state on subsequent render - log to Sentry
      captureClientException(
        new Error("Auth edge case: Clerk authenticated but Convex user not found"),
        {
          tags: {
            error_type: "auth_user_not_found",
            clerk_id: user.id,
          },
          extras: {
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            emailVerified: user.primaryEmailAddress?.verification?.status,
            createdAt: user.createdAt,
            userCreationLoading,
            hasCurrentUser: !!currentUser,
          },
          level: "warning",
        },
      );

      prevStateRef.current = result;
      return result;
    }

    // Handle fully authenticated state with Convex user
    const result: UseAuthStateReturn = {
      userId: currentUser._id, // Return Convex database ID, not Clerk ID
      isAuthenticated: true,
      isLoading: false,
    };

    // Development-only debug logging for state transitions
    if (process.env.NODE_ENV === "development") {
      if (
        !prevStateRef.current ||
        prevStateRef.current.isAuthenticated !== result.isAuthenticated ||
        prevStateRef.current.userId !== result.userId
      ) {
        logger.debug("[useAuthState] User authenticated with Convex ID:", {
          convexId: result.userId,
          clerkId: user.id,
          previousState: prevStateRef.current,
        });
      }
    }

    prevStateRef.current = result;
    return result;
  }, [user, isLoaded, isSignedIn, currentUser, userCreationLoading]);
}
