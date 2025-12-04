/**
 * Shared retry logic utilities
 * Used by useQueryWithRetry and useMutationWithRetry hooks
 */

import { logger } from "@/lib/logger";

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Determines if an error should be retried based on common transient patterns
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("server error") ||
    message.includes("timeout") ||
    message.includes("fetch") ||
    message.includes("convex") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("failed to fetch") ||
    message.includes("request failed")
  );
}

/**
 * Default configuration for retry behavior
 */
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 4000, // 4 seconds max
  shouldRetry: isRetryableError,
  onRetry: (attempt: number, error: Error) => {
    logger.warn(`[retry] Attempt ${attempt}:`, {
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Calculate exponential backoff delay with jitter
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap
 * @returns Delay in milliseconds with jitter applied
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  // Exponential backoff: 1s, 2s, 4s
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Add jitter to prevent thundering herd (±25%)
  const jitter = Math.random() * 0.5 + 0.75;
  const delayWithJitter = Math.floor(exponentialDelay * jitter);
  // Cap at max delay
  return Math.min(delayWithJitter, maxDelayMs);
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
