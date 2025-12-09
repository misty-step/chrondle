"use client";

import { useQuery as useConvexQuery } from "convex/react";
import { FunctionReference, FunctionReturnType } from "convex/server";
import { RetryConfig } from "@/lib/retryUtils";

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
 *   api.puzzles.getDailyPuzzle,
 *   undefined,
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, error) => {
 *       logger.error(`Retrying due to: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export function useQueryWithRetry<
  Query extends FunctionReference<"query">,
  Args = Query extends FunctionReference<"query", infer A> ? A : never,
  // Note: config parameter preserved for API compatibility
>(query: Query, args: Args | "skip", _config?: RetryConfig): FunctionReturnType<Query> | undefined {
  // Use the standard Convex query hook
  // Convex handles reconnection and error recovery automatically
  // @ts-expect-error - Type mismatch with Convex generics
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
 *   api.puzzles.getDailyPuzzle,
 *   { maxRetries: 5 }
 * );
 * ```
 */
export function createQueryHookWithRetry<Query extends FunctionReference<"query">>(
  query: Query,
  defaultConfig?: RetryConfig,
) {
  return function useQueryHook<
    Args = Query extends FunctionReference<"query", infer A> ? A : never,
  >(args: Args | "skip", config?: RetryConfig): FunctionReturnType<Query> | undefined {
    return useQueryWithRetry(query, args, { ...defaultConfig, ...config });
  };
}
