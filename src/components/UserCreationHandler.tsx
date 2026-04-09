"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
import { anyPublicApi } from "@/lib/convexAnyApi";
import { logger } from "@/lib/logger";

interface AuthState {
  hasClerkUser: boolean;
  hasConvexUser: boolean;
  completedCount: number;
  totalCount: number;
  environment: string;
  timestamp: string;
}

interface UserCreationHandlerProps {
  authState: AuthState;
  children: React.ReactNode;
}

/**
 * Client-side component that handles JIT user creation for server components
 * Detects when user is signed in via Clerk but has no Convex user record
 * and triggers user creation with appropriate loading state
 */
export function UserCreationHandler({ authState, children }: UserCreationHandlerProps) {
  const { isSignedIn } = useUser();
  const getOrCreateUser = useMutationWithRetry(
    anyPublicApi.users.getOrCreateCurrentUser,
    useMemo(
      () => ({
        maxRetries: 3,
        baseDelayMs: 1000,
        onRetry: (attempt: number, error: Error) => {
          logger.error(
            `[UserCreationHandler] Retrying user creation (attempt ${attempt}/3):`,
            error.message,
          );
        },
      }),
      [],
    ),
  );

  const [userCreationLoading, setUserCreationLoading] = useState(false);
  const [userCreationCompleted, setUserCreationCompleted] = useState(false);
  const [shouldRefresh, setShouldRefresh] = useState(false);

  // Detect if user creation is needed
  const needsUserCreation = useMemo(
    () =>
      isSignedIn && authState.hasClerkUser && !authState.hasConvexUser && !userCreationCompleted,
    [isSignedIn, authState.hasClerkUser, authState.hasConvexUser, userCreationCompleted],
  );

  const handleUserCreation = useCallback(async () => {
    if (needsUserCreation && !userCreationLoading && !userCreationCompleted) {
      // Debug: Triggering JIT user creation

      try {
        setUserCreationLoading(true);
        await getOrCreateUser({});

        setUserCreationCompleted(true);

        // Trigger page refresh to get updated completion data
        setShouldRefresh(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("[UserCreationHandler] User creation failed:", {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        // Don't block the UI if user creation fails
      } finally {
        setUserCreationLoading(false);
      }
    }
  }, [needsUserCreation, userCreationLoading, userCreationCompleted, getOrCreateUser]);

  useEffect(() => {
    handleUserCreation();
  }, [handleUserCreation]);

  // Handle page refresh after successful user creation
  useEffect(() => {
    if (shouldRefresh && !userCreationLoading) {
      // Small delay to ensure mutation is fully processed
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, [shouldRefresh, userCreationLoading]);

  // Show loading state during user creation
  if (userCreationLoading) {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <div className="flex flex-grow items-center justify-center">
          <div className="text-center">
            <div className="text-muted-foreground mb-2 animate-pulse">
              Setting up your account...
            </div>
            <div className="text-muted-foreground text-sm">This will only take a moment</div>
          </div>
        </div>
      </div>
    );
  }

  // Normal rendering
  return <>{children}</>;
}
