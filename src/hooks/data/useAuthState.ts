"use client";

import { useEffect, useMemo, useRef } from "react";
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

type AuthPhase =
  | "loading"
  | "signed-out"
  | "missing-clerk-id"
  | "awaiting-convex-user"
  | "authenticated";

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
  const prevPhaseRef = useRef<AuthPhase | null>(null);

  const authPhase = useMemo<AuthPhase>(() => {
    if (!isLoaded || userCreationLoading) {
      return "loading";
    }
    if (!isSignedIn || !user) {
      return "signed-out";
    }
    if (!user.id) {
      return "missing-clerk-id";
    }
    if (!currentUser) {
      return "awaiting-convex-user";
    }
    return "authenticated";
  }, [currentUser, isLoaded, isSignedIn, user, userCreationLoading]);

  const result = useMemo<UseAuthStateReturn>(() => {
    switch (authPhase) {
      case "loading":
        return {
          userId: null,
          isAuthenticated: false,
          isLoading: true,
        };
      case "signed-out":
      case "missing-clerk-id":
        return {
          userId: null,
          isAuthenticated: false,
          isLoading: false,
        };
      case "awaiting-convex-user":
        return {
          userId: null,
          isAuthenticated: true,
          isLoading: true,
        };
      case "authenticated":
        return {
          userId: currentUser!._id,
          isAuthenticated: true,
          isLoading: false,
        };
    }
  }, [authPhase, currentUser]);

  useEffect(() => {
    const prevState = prevStateRef.current;
    const prevPhase = prevPhaseRef.current;

    if (process.env.NODE_ENV === "development" && prevPhase !== authPhase) {
      switch (authPhase) {
        case "loading":
          logger.debug("[useAuthState] Auth loading...", {
            clerkLoaded: isLoaded,
            userCreationLoading,
          });
          break;
        case "signed-out":
          logger.debug("[useAuthState] User signed out");
          break;
        case "missing-clerk-id":
          logger.warn("[useAuthState] Edge case: User object exists but no ID found", { user });
          break;
        case "awaiting-convex-user":
          logger.warn("[useAuthState] Clerk authenticated but Convex user not ready:", {
            clerkId: user?.id,
            email: user?.primaryEmailAddress?.emailAddress,
            currentUser,
          });
          break;
        case "authenticated":
          logger.debug("[useAuthState] User authenticated with Convex ID:", {
            convexId: result.userId,
            clerkId: user?.id,
            previousState: prevState,
          });
          break;
      }
    }

    if (authPhase === "awaiting-convex-user" && prevState?.isLoading && prevPhase !== authPhase) {
      captureClientException(
        new Error("Auth edge case: Clerk authenticated but Convex user not found"),
        {
          tags: {
            error_type: "auth_user_not_found",
            clerk_id: user?.id ?? "unknown",
          },
          extras: {
            clerkId: user?.id,
            email: user?.primaryEmailAddress?.emailAddress,
            emailVerified: user?.primaryEmailAddress?.verification?.status,
            createdAt: user?.createdAt,
            userCreationLoading,
            hasCurrentUser: !!currentUser,
          },
          level: "warning",
        },
      );
    }

    prevPhaseRef.current = authPhase;
    prevStateRef.current = result;
  }, [authPhase, currentUser, isLoaded, result, user, userCreationLoading]);

  return result;
}
