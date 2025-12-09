"use client";

import { useRef, useCallback, useMemo } from "react";
import { useMutation as useConvexMutation } from "convex/react";
import { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { logger } from "@/lib/logger";
import { RetryConfig, DEFAULT_RETRY_CONFIG, calculateBackoffDelay, sleep } from "@/lib/retryUtils";

// Re-export RetryConfig for consumers
export type { RetryConfig };

/**
 * Hook that wraps Convex useMutation with retry logic for transient errors
 *
 * @param mutation - The Convex mutation function reference
 * @param config - Optional retry configuration
 * @returns A mutation function with retry behavior
 *
 * @example
 * ```typescript
 * const submitWithRetry = useMutationWithRetry(
 *   api.puzzles.submitGuess,
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error) => {
 *       logger.debug(`Retrying submission: ${error.message}`);
 *     }
 *   }
 * );
 *
 * try {
 *   await submitWithRetry({ puzzleId, userId, guess });
 * } catch (error) {
 *   // Handle error after all retries failed
 * }
 * ```
 */
export function useMutationWithRetry<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  config?: RetryConfig,
): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  // Memoize config to avoid dependency changes
  const mergedConfig = useMemo(
    () => ({
      ...DEFAULT_RETRY_CONFIG,
      // Override onRetry to use hook-specific context
      onRetry: (attempt: number, error: Error) => {
        logger.warn(`[useMutationWithRetry] Retry attempt ${attempt}:`, {
          error: error.message,
          timestamp: new Date().toISOString(),
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
      },
      ...config,
    }),
    [config],
  );

  // Use the standard Convex mutation hook
  const mutate = useConvexMutation(mutation);

  // Track retry state
  const retryCountRef = useRef(0);

  // Create the wrapped mutation function with retry logic
  const mutateWithRetry = useCallback(
    async (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      let lastError: Error | null = null;
      retryCountRef.current = 0;

      for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
        try {
          // Attempt the mutation
          const result = await mutate(args);

          // Success! Reset retry count and return
          retryCountRef.current = 0;

          if (process.env.NODE_ENV === "development" && attempt > 0) {
            logger.info(`[useMutationWithRetry] Succeeded after ${attempt} retries:`, {
              mutation: "mutation",
              timestamp: new Date().toISOString(),
            });
          }

          return result;
        } catch (error) {
          lastError = error as Error;

          // Check if we should retry this error
          if (!mergedConfig.shouldRetry(lastError)) {
            logger.error("[useMutationWithRetry] Non-retryable error:", {
              mutation: "mutation",
              error: lastError.message,
              timestamp: new Date().toISOString(),
            });
            throw lastError;
          }

          // Don't retry on last attempt
          if (attempt === mergedConfig.maxRetries) {
            logger.error("[useMutationWithRetry] Max retries reached:", {
              mutation: "mutation",
              retries: attempt,
              error: lastError.message,
              timestamp: new Date().toISOString(),
            });
            break;
          }

          // Calculate delay and log retry attempt
          const delay = calculateBackoffDelay(
            attempt,
            mergedConfig.baseDelayMs,
            mergedConfig.maxDelayMs,
          );

          // Notify about retry
          mergedConfig.onRetry(attempt + 1, lastError);

          logger.error(
            `[useMutationWithRetry] Retrying ${attempt + 1}/${mergedConfig.maxRetries} after ${delay}ms`,
          );

          // Wait before retrying
          await sleep(delay);
          retryCountRef.current = attempt + 1;
        }
      }

      // If we get here, all retries failed
      const finalError = lastError || new Error("Mutation failed after all retries");

      logger.error("[useMutationWithRetry] All retries exhausted:", {
        mutation: "mutation",
        totalAttempts: mergedConfig.maxRetries + 1,
        error: finalError.message,
        timestamp: new Date().toISOString(),
      });

      throw finalError;
    },
    [mutate, mergedConfig],
  );

  return mutateWithRetry;
}

/**
 * Higher-order function to create a custom mutation hook with retry logic
 * This is useful for creating specialized hooks with consistent retry behavior
 *
 * @example
 * ```typescript
 * export const useSubmitGuessWithRetry = createMutationHookWithRetry(
 *   api.puzzles.submitGuess,
 *   { maxRetries: 5 }
 * );
 * ```
 */
export function createMutationHookWithRetry<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  defaultConfig?: RetryConfig,
) {
  return function useMutationHook(
    config?: RetryConfig,
  ): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
    return useMutationWithRetry(mutation, { ...defaultConfig, ...config });
  };
}
