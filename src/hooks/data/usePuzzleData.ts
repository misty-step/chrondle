"use client";

import { useMemo, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { PuzzleWithContext } from "@/types/puzzle";
import { getLocalDateString } from "@/lib/time/dailyDate";
import { logger } from "@/lib/logger";

/**
 * Puzzle data structure returned from Convex
 */
interface ConvexPuzzle {
  _id: string;
  targetYear: number;
  events: string[];
  puzzleNumber: number;
  date?: string;
  historicalContext?: string;
}

/**
 * Return type for the usePuzzleData hook
 */
interface UsePuzzleDataReturn {
  puzzle: PuzzleWithContext | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch puzzle data from Convex
 *
 * This hook is completely orthogonal - it has no knowledge of authentication,
 * users, or any other concerns. Its single responsibility is fetching puzzle data.
 *
 * Local Date Selection: For daily puzzles, this hook uses the client's local date
 * to determine which puzzle to fetch. This ensures users see "today's puzzle"
 * based on their timezone, not UTC.
 *
 * @param puzzleNumber - Optional puzzle number for archive puzzles. If not provided, fetches today's daily puzzle.
 * @param initialData - Optional initial puzzle data to skip loading state (for SSR)
 * @returns Object containing puzzle data, loading state, and error state
 *
 * @example
 * // Fetch today's daily puzzle (uses local date)
 * const { puzzle, isLoading, error } = usePuzzleData();
 *
 * @example
 * // Fetch a specific archive puzzle
 * const { puzzle, isLoading, error } = usePuzzleData(42);
 *
 * @example
 * // Use with preloaded data from server
 * const { puzzle, isLoading, error } = usePuzzleData(undefined, preloadedPuzzle);
 */
export function usePuzzleData(puzzleNumber?: number, initialData?: unknown): UsePuzzleDataReturn {
  // If initial data is provided, skip queries and use it directly
  const shouldSkipQuery = initialData !== undefined;

  // Compute local date for daily puzzle selection
  // This is stable during the day and flips at local midnight
  const [localDate, setLocalDate] = useState(() => getLocalDateString());

  // Update local date when it changes (midnight boundary)
  useEffect(() => {
    const checkDate = () => {
      const currentDate = getLocalDateString();
      if (currentDate !== localDate) {
        setLocalDate(currentDate);
      }
    };

    // Check every minute for date changes (handles midnight crossing)
    const interval = setInterval(checkDate, 60000);
    return () => clearInterval(interval);
  }, [localDate]);

  // Daily mode: fetch puzzle by local date
  const isDaily = puzzleNumber === undefined && !shouldSkipQuery;
  const localPuzzle = useQuery(
    api.puzzles.getPuzzleByDate,
    isDaily ? { date: localDate } : "skip",
  ) as ConvexPuzzle | null | undefined;

  // Mutation for on-demand puzzle generation with date support
  const ensurePuzzleForDate = useMutation(api.puzzles.ensurePuzzleForDate);

  // Trigger on-demand generation if puzzle for local date is null
  useEffect(() => {
    if (isDaily && localPuzzle === null) {
      logger.warn(`[usePuzzleData] No puzzle found for local date ${localDate}, triggering ensure`);

      ensurePuzzleForDate({ date: localDate }).catch((error) => {
        // Log but don't break - could be outside window, will fallback
        logger.error("[usePuzzleData] Failed to ensure puzzle for date:", error);
      });
    }
  }, [localPuzzle, isDaily, localDate, ensurePuzzleForDate]);

  // Fetch archive puzzle if puzzle number provided and no initial data
  const archivePuzzle = useQuery(
    api.puzzles.getPuzzleByNumber,
    puzzleNumber !== undefined && !shouldSkipQuery ? { puzzleNumber } : "skip",
  ) as ConvexPuzzle | null | undefined;

  // Select the appropriate puzzle based on parameters
  const convexPuzzle = shouldSkipQuery
    ? (initialData as ConvexPuzzle | null | undefined)
    : puzzleNumber !== undefined
      ? archivePuzzle
      : localPuzzle;

  // Memoize the return value to ensure stable references
  return useMemo<UsePuzzleDataReturn>(() => {
    // When using initial data, never show loading state
    if (shouldSkipQuery && initialData !== undefined) {
      if (initialData === null) {
        // Initial data explicitly null means no puzzle
        const errorMessage =
          puzzleNumber !== undefined
            ? `Puzzle #${puzzleNumber} not found`
            : "No daily puzzle available";
        return {
          puzzle: null,
          isLoading: false,
          error: new Error(errorMessage),
        };
      }

      // Type guard to ensure initialData is a ConvexPuzzle
      const puzzleData = initialData as ConvexPuzzle;

      // Normalize the initial data
      const normalizedPuzzle: PuzzleWithContext = {
        id: puzzleData._id as Id<"puzzles">,
        targetYear: puzzleData.targetYear,
        events: puzzleData.events,
        puzzleNumber: puzzleData.puzzleNumber,
        historicalContext: puzzleData.historicalContext,
      };

      return {
        puzzle: normalizedPuzzle,
        isLoading: false,
        error: null,
      };
    }

    // Handle loading state when fetching from server
    if (convexPuzzle === undefined) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
      };
    }

    // Handle null result (puzzle not found)
    if (convexPuzzle === null) {
      const errorMessage =
        puzzleNumber !== undefined
          ? `Puzzle #${puzzleNumber} not found`
          : "No daily puzzle available";

      return {
        puzzle: null,
        isLoading: false,
        error: new Error(errorMessage),
      };
    }

    // Normalize the puzzle data
    const normalizedPuzzle: PuzzleWithContext = {
      id: convexPuzzle._id as Id<"puzzles">,
      targetYear: convexPuzzle.targetYear,
      events: convexPuzzle.events,
      puzzleNumber: convexPuzzle.puzzleNumber,
      historicalContext: convexPuzzle.historicalContext,
    };

    // Return successful result
    return {
      puzzle: normalizedPuzzle,
      isLoading: false,
      error: null,
    };
  }, [convexPuzzle, puzzleNumber, shouldSkipQuery, initialData]);
}
