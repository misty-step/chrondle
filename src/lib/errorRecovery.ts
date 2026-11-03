import { calculateBackoffDelay, isRetryableError } from "@/lib/retryUtils";

export type ErrorRecoverability = "recoverable" | "unrecoverable";

export interface LoadErrorRecoveryPlan {
  recoverability: ErrorRecoverability;
  canAutoRetry: boolean;
}

const UNRECOVERABLE_PATTERNS = [
  "not found",
  "no daily puzzle available",
  "no order puzzle available",
  "unauthorized",
  "forbidden",
  "invalid puzzle",
];

export function classifyLoadError(errorMessage: string): LoadErrorRecoveryPlan {
  if (errorMessage === BACKEND_UNREACHABLE_ERROR) {
    return { recoverability: "recoverable", canAutoRetry: true };
  }

  const normalized = errorMessage.toLowerCase();
  const isExplicitlyUnrecoverable = UNRECOVERABLE_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
  const recoverable = !isExplicitlyUnrecoverable && isRetryableError(new Error(errorMessage));

  return {
    recoverability: recoverable ? "recoverable" : "unrecoverable",
    canAutoRetry: recoverable,
  };
}

export function getAutoRetryDelayMs(attempt: number): number {
  return calculateBackoffDelay(attempt, 1000, 4000);
}

/** How long a puzzle load may stall before we tell the player the server is unreachable */
export const BACKEND_UNREACHABLE_TIMEOUT_MS = 10_000;

export const BACKEND_UNREACHABLE_ERROR =
  "We can't reach the Chrondle server right now. Check your connection and try again.";

/** The server answered, but could not create today's puzzle */
export const PUZZLE_UNAVAILABLE_ERROR =
  "Today's puzzle isn't available right now. Please try again in a moment.";
