/**
 * Shared game submission authentication and error handling logic.
 * Used by both Classic and Order game modes to ensure consistent behavior.
 */

import { captureClientException } from "@/observability/sentry.client";
import type { MutationError } from "@/observability/mutationErrorAdapter";

export type SubmissionAuthErrorCode = "AUTH_PENDING" | "AUTH_INCOMPLETE" | "MISSING_PUZZLE";

export interface SubmissionAuthError {
  code: SubmissionAuthErrorCode;
  message: string;
  shouldAlert: boolean; // Whether to send to Sentry
  retryable: boolean;
}

export interface AuthCheckResult {
  canPersist: boolean; // Whether we should attempt server persistence
  isAnonymous: boolean; // User is playing anonymously (valid state)
  isAuthPending: boolean; // Auth edge case: authenticated but no userId yet
  error?: SubmissionAuthError;
}

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
}

/**
 * Determines whether a game submission can be persisted to the server.
 * Handles 4 distinct scenarios:
 * 1. Anonymous users (not authenticated) → valid, local-only gameplay
 * 2. Fully authenticated (has userId) → valid, persist to server
 * 3. Auth pending (authenticated but userId null) → BUG to fix, show error
 * 4. Missing puzzle data → validation error
 */
export function checkSubmissionAuth(
  auth: AuthState,
  puzzleId: string | null,
  context?: { gameMode: "classic" | "order"; action: string },
): AuthCheckResult {
  // Scenario 1: Anonymous user - valid local-only gameplay
  if (!auth.isAuthenticated) {
    return {
      canPersist: false,
      isAnonymous: true,
      isAuthPending: false,
    };
  }

  // Scenario 2: Fully authenticated - ready to persist
  if (auth.userId && puzzleId) {
    return {
      canPersist: true,
      isAnonymous: false,
      isAuthPending: false,
    };
  }

  // Scenario 3: Auth edge case - authenticated but userId still null
  // This can happen if Clerk auth completes but Convex query hasn't returned user yet
  if (auth.isAuthenticated && !auth.userId) {
    const error: SubmissionAuthError = {
      code: "AUTH_PENDING",
      message: "Loading your account data. Please wait a moment and try again.",
      shouldAlert: true, // Critical: this should never happen silently
      retryable: true,
    };

    // Log to Sentry with context
    if (context) {
      captureClientException(
        new Error(
          `Submission attempted during auth edge case: ${context.gameMode} ${context.action}`,
        ),
        {
          tags: {
            error_type: "auth_pending",
            game_mode: context.gameMode,
            action: context.action,
          },
          extras: {
            auth_state: {
              isAuthenticated: auth.isAuthenticated,
              userId: auth.userId,
              isLoading: auth.isLoading,
            },
            puzzleId,
          },
          level: "warning",
        },
      );
    }

    return {
      canPersist: false,
      isAnonymous: false,
      isAuthPending: true,
      error,
    };
  }

  // Scenario 4: Missing puzzle data - validation error
  const error: SubmissionAuthError = {
    code: "MISSING_PUZZLE",
    message: "Puzzle data not available. Please refresh the page.",
    shouldAlert: false, // User-driven error, not a system issue
    retryable: true,
  };

  return {
    canPersist: false,
    isAnonymous: false,
    isAuthPending: false,
    error,
  };
}

/**
 * Converts a SubmissionAuthError to a MutationError tuple for consistent error handling.
 * This allows submission functions to return the same error format whether the error
 * comes from auth checks or from the mutation itself.
 */
export function handleSubmissionError(authError: SubmissionAuthError): [null, MutationError] {
  const mutationError: MutationError = {
    code: authError.code === "AUTH_PENDING" ? "AUTH" : "VALIDATION",
    message: authError.message,
    retryable: authError.retryable,
    originalError: new Error(authError.message),
  };

  return [null, mutationError];
}

/**
 * Logs submission attempts for production observability.
 * Helps track successful submissions vs. failures vs. anonymous plays.
 */
export function logSubmissionAttempt(
  gameMode: "classic" | "order",
  action: string,
  result: AuthCheckResult,
  outcome?: "success" | "failure",
) {
  // In production, this would go to structured logging
  // For now, use console.info which is captured by Sentry breadcrumbs
  // eslint-disable-next-line no-console
  console.info("[Submission]", {
    gameMode,
    action,
    canPersist: result.canPersist,
    isAnonymous: result.isAnonymous,
    isAuthPending: result.isAuthPending,
    hasError: !!result.error,
    errorCode: result.error?.code,
    outcome,
    timestamp: new Date().toISOString(),
  });
}
