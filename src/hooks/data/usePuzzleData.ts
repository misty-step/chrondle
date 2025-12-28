"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { PuzzleWithContext } from "@/types/puzzle";
import { useTodaysPuzzle } from "@/hooks/useTodaysPuzzle";

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
 * This hook handles two modes:
 * 1. Daily puzzle (no puzzleNumber): Delegates to useTodaysPuzzle for proper
 *    local date handling, visibility change detection, and preload validation.
 * 2. Archive puzzle (with puzzleNumber): Fetches specific puzzle by number.
 *
 * For daily puzzles, this ensures users see "today's puzzle" based on their
 * LOCAL timezone, not UTC. Preloaded data from SSR is validated against the
 * client's local date before being used.
 *
 * @param puzzleNumber - Optional puzzle number for archive puzzles. If not provided, fetches today's daily puzzle.
 * @param initialData - Optional initial puzzle data from SSR (validated against local date for daily puzzles)
 * @returns Object containing puzzle data, loading state, and error state
 *
 * @example
 * // Fetch today's daily puzzle (uses local date, handles timezone correctly)
 * const { puzzle, isLoading, error } = usePuzzleData();
 *
 * @example
 * // Fetch a specific archive puzzle
 * const { puzzle, isLoading, error } = usePuzzleData(42);
 *
 * @example
 * // Use with preloaded data from server (validated against local date)
 * const { puzzle, isLoading, error } = usePuzzleData(undefined, preloadedPuzzle);
 */
export function usePuzzleData(puzzleNumber?: number, initialData?: unknown): UsePuzzleDataReturn {
  const isDaily = puzzleNumber === undefined;

  // For daily puzzles, use the new useTodaysPuzzle hook which handles:
  // - Local date as source of truth
  // - Preload validation against local date
  // - Visibility change detection (tab focus)
  // - Midnight rollover detection
  const todaysPuzzle = useTodaysPuzzle(
    isDaily ? { preloadedPuzzle: initialData as ConvexPuzzle | null | undefined } : {},
  );

  // For archive puzzles, check if initial data matches requested puzzle number
  const archiveInitialData = !isDaily ? (initialData as ConvexPuzzle | null | undefined) : null;
  const archiveInitialMatchesPuzzle =
    archiveInitialData && archiveInitialData.puzzleNumber === puzzleNumber;

  // For archive puzzles, fetch by puzzle number (skip if we already have matching initial data)
  const archivePuzzle = useQuery(
    api.puzzles.getPuzzleByNumber,
    !isDaily && !archiveInitialMatchesPuzzle ? { puzzleNumber } : "skip",
  ) as ConvexPuzzle | null | undefined;

  // Use initial data if it matches, otherwise use query result
  const archiveData = archiveInitialMatchesPuzzle ? archiveInitialData : archivePuzzle;

  // Memoize the return value to ensure stable references
  return useMemo<UsePuzzleDataReturn>(() => {
    // === DAILY PUZZLE MODE ===
    if (isDaily) {
      if (todaysPuzzle.isLoading) {
        return {
          puzzle: null,
          isLoading: true,
          error: null,
        };
      }

      if (todaysPuzzle.error) {
        return {
          puzzle: null,
          isLoading: false,
          error: new Error(todaysPuzzle.error),
        };
      }

      // Defensive: useTodaysPuzzle returns isLoading=true while triggering on-demand
      // generation, so this branch only fires on unexpected state (e.g., generation
      // mutation fails silently without setting error). Kept for robustness.
      if (!todaysPuzzle.puzzle) {
        return {
          puzzle: null,
          isLoading: false,
          error: new Error("No daily puzzle available"),
        };
      }

      // Convert TodaysPuzzle to PuzzleWithContext
      const normalizedPuzzle: PuzzleWithContext = {
        id: todaysPuzzle.puzzle.id,
        targetYear: todaysPuzzle.puzzle.targetYear,
        events: todaysPuzzle.puzzle.events,
        puzzleNumber: todaysPuzzle.puzzle.puzzleNumber,
        historicalContext: todaysPuzzle.puzzle.historicalContext,
      };

      return {
        puzzle: normalizedPuzzle,
        isLoading: false,
        error: null,
      };
    }

    // === ARCHIVE PUZZLE MODE ===

    // Handle loading state
    if (archiveData === undefined) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
      };
    }

    // Handle null result (puzzle not found)
    if (archiveData === null) {
      return {
        puzzle: null,
        isLoading: false,
        error: new Error(`Puzzle #${puzzleNumber} not found`),
      };
    }

    // Normalize the puzzle data
    const normalizedPuzzle: PuzzleWithContext = {
      id: archiveData._id as Id<"puzzles">,
      targetYear: archiveData.targetYear,
      events: archiveData.events,
      puzzleNumber: archiveData.puzzleNumber,
      historicalContext: archiveData.historicalContext,
    };

    return {
      puzzle: normalizedPuzzle,
      isLoading: false,
      error: null,
    };
  }, [isDaily, todaysPuzzle, archiveData, puzzleNumber]);
}
