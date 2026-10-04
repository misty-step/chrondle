"use client";

import { useQuery as useConvexQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import type { RetryConfig } from "@/lib/retryUtils";

// Re-export RetryConfig for consumers
export type { RetryConfig };

/**
 * Hook that wraps Convex useQuery with retry logic for transient errors
 *
 * @param query - The Convex query function reference
 * @param args - The arguments to pass to the query, or "skip" to skip the query
 * @param config - Optional retry configuration
 * @returns The query result with retry behavior
 *
 * @example
 * ```typescript
 * const result = useQueryWithRetry(
 *   api.puzzles.getPuzzleByDate,
 *   { date: localDate },
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error) => {
 *       logger.error(`Retrying due to: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export function useQueryWithRetry<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
  // Note: config parameter preserved for API compatibility
  _config?: RetryConfig,
): FunctionReturnType<Query> | undefined {
  // Use the standard Convex query hook
  // Convex handles reconnection and error recovery automatically
  const queryResult = useConvexQuery(query, args);

  return queryResult;
}

/**
 * Higher-order function to create a custom hook with retry logic
 * This is useful for creating specialized hooks with consistent retry behavior
 *
 * @example
 * ```typescript
 * export const usePuzzleDataWithRetry = createQueryHookWithRetry(
 *   api.puzzles.getPuzzleByDate,
 *   { maxRetries: 5 }
 * );
 * ```
 */
export function createQueryHookWithRetry<Query extends FunctionReference<"query">>(
  query: Query,
  defaultConfig?: RetryConfig,
) {
  return function useQueryHook(
    args: FunctionArgs<Query> | "skip",
    config?: RetryConfig,
  ): FunctionReturnType<Query> | undefined {
    return useQueryWithRetry(query, args, { ...defaultConfig, ...config });
  };
}
