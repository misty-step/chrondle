import { ConvexError } from "convex/values";
import { captureClientException } from "./sentry.client";

export type MutationErrorCode = "VALIDATION" | "AUTH" | "NETWORK" | "SERVER" | "UNKNOWN";

export interface MutationError {
  code: MutationErrorCode;
  message: string;
  retryable: boolean;
  originalError: unknown;
  traceId?: string;
}

/**
 * Classifies an error from a Convex mutation into a structured MutationError
 */
export function classifyMutationError(error: unknown): MutationError {
  // Handle Convex business logic errors (thrown via throw new ConvexError(...))
  if (error instanceof ConvexError) {
    const message =
      typeof error.data === "string"
        ? error.data
        : typeof error.data === "object" && error.data && "message" in error.data
          ? String(error.data.message)
          : error.message || "Validation failed";

    return {
      code: "VALIDATION",
      message,
      retryable: false,
      originalError: error,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Auth errors - catch various patterns from Convex mutations
    if (
      message.includes("unauthenticated") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("authentication required") ||
      message.includes("user not found") ||
      message.includes("not authenticated")
    ) {
      return {
        code: "AUTH",
        message: "Please sign in to perform this action.",
        retryable: false,
        originalError: error,
      };
    }

    // Validation errors from server-side checks
    if (
      message.includes("validation failed") ||
      message.includes("score verification failed") ||
      message.includes("puzzle not found") ||
      message.includes("mismatch")
    ) {
      return {
        code: "VALIDATION",
        message: "Something went wrong validating your submission. Please try again.",
        retryable: true,
        originalError: error,
      };
    }

    // Network/Connection errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection") ||
      message.includes("offline") ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("dns") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("enotfound") ||
      message.includes("socket")
    ) {
      return {
        code: "NETWORK",
        message: "Network connection lost. Please check your internet.",
        retryable: true,
        originalError: error,
      };
    }
  }

  // Default/Unknown errors
  return {
    code: "UNKNOWN",
    message: "An unexpected error occurred. Please try again.",
    retryable: true, // Assume retryable for unknown server hiccups
    originalError: error,
  };
}

/**
 * Safe mutation wrapper that handles error classification and Sentry reporting
 * @param mutationFn The async mutation function to execute
 * @param context Context for Sentry (e.g., puzzleId, userId)
 * @returns Tuple of [result, null] or [null, MutationError]
 */
export async function safeMutation<T>(
  mutationFn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<[T, null] | [null, MutationError]> {
  try {
    const result = await mutationFn();
    return [result, null];
  } catch (err) {
    const error = classifyMutationError(err);

    // Only capture unexpected errors or critical failures
    // Validation errors are usually user-driven and don't need Sentry noise
    // unless we want to track UX issues.
    // DESIGN.md says: "Client shows toast... message logged to Sentry"
    // So we capture all, maybe with different levels.

    const level = error.code === "VALIDATION" ? "info" : "error";

    captureClientException(error.originalError, {
      tags: {
        mutation_code: error.code,
        retryable: error.retryable,
      },
      extras: {
        ...context,
        mutation_message: error.message,
      },
      level,
    });

    return [null, error];
  }
}
