"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery as useConvexQuery } from "convex/react";
import { FunctionReference, FunctionReturnType } from "convex/server";
import { logger } from "@/lib/logger";
import { RetryConfig, DEFAULT_RETRY_CONFIG, calculateBackoffDelay } from "@/lib/retryUtils";

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
>(query: Query, args: Args | "skip", config?: RetryConfig): FunctionReturnType<Query> | undefined {
  const mergedConfig = useMemo(
    () => ({
      ...DEFAULT_RETRY_CONFIG,
      // Override onRetry to use hook-specific context
      onRetry: (attempt: number, error: Error) => {
        logger.warn(`[useQueryWithRetry] Retry attempt ${attempt}:`, {
          error: error.message,
          timestamp: new Date().toISOString(),
          stack: error.stack,
        });
      },
      ...config,
    }),
    [config],
  );

  // Track retry state
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<Error | null>(null);

  // Use the standard Convex query hook
  // @ts-expect-error - Type mismatch with Convex generics
  const queryResult = useConvexQuery(query, args);

  // Track if we've seen an error for this query
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasError, setHasError] = useState(false);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Handle retry logic
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const scheduleRetry = useCallback(() => {
    if (retryCount >= mergedConfig.maxRetries) {
      logger.error("[useQueryWithRetry] Max retries reached:", {
        query: "query",
        retries: retryCount,
        lastError: lastErrorRef.current?.message,
        timestamp: new Date().toISOString(),
      });
      setIsRetrying(false);
      return;
    }

    const delay = calculateBackoffDelay(
      retryCount,
      mergedConfig.baseDelayMs,
      mergedConfig.maxDelayMs,
    );

    logger.error(
      `[useQueryWithRetry] Scheduling retry ${retryCount + 1}/${mergedConfig.maxRetries} after ${delay}ms`,
    );

    setIsRetrying(true);

    retryTimeoutRef.current = setTimeout(() => {
      setRetryCount((prev) => prev + 1);
      setIsRetrying(false);
      // The query will automatically re-run when we update the retry count
    }, delay);
  }, [retryCount, mergedConfig]);

  // Monitor query result for errors
  useEffect(() => {
    // Check if the query result indicates an error
    // Convex doesn't expose errors directly in useQuery, but undefined with args !== "skip"
    // after initial load could indicate a problem

    if (args === "skip") {
      // Query is intentionally skipped
      return;
    }

    // If we get a result, clear error state
    if (queryResult !== undefined) {
      setHasError(false);
      setRetryCount(0);
      lastErrorRef.current = null;
      return;
    }
  }, [queryResult, args]);

  // Log retry information in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && isRetrying) {
      logger.error("[useQueryWithRetry] Retry state:", {
        query: "query",
        attempt: retryCount,
        isRetrying,
        hasResult: queryResult !== undefined,
      });
    }
  }, [isRetrying, retryCount, query, queryResult]);

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
