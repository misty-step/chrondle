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
 *    local date handling and visibility change detection.
 * 2. Archive puzzle (with puzzleNumber): Fetches specific puzzle by number.
 *
 * For daily puzzles, this ensures users see "today's puzzle" based on their
 * LOCAL timezone, not UTC.
 *
 * @param puzzleNumber - Optional puzzle number for archive puzzles. If not provided, fetches today's daily puzzle.
 * @returns Object containing puzzle data, loading state, and error state
 *
 * @example
 * // Fetch today's daily puzzle
 * const { puzzle, isLoading, error } = usePuzzleData();
 *
 * @example
 * // Fetch a specific archive puzzle
 * const { puzzle, isLoading, error } = usePuzzleData(42);
 */
export function usePuzzleData(puzzleNumber?: number): UsePuzzleDataReturn {
  const isDaily = puzzleNumber === undefined;

  // For daily puzzles, use useTodaysPuzzle which handles:
  // - Local date as source of truth
  // - Visibility change detection (tab focus)
  // - Midnight rollover detection
  const todaysPuzzle = useTodaysPuzzle();

  // For archive puzzles, fetch by puzzle number
  const archivePuzzle = useQuery(
    api.puzzles.getPuzzleByNumber,
    !isDaily ? { puzzleNumber } : "skip",
  ) as ConvexPuzzle | null | undefined;

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
      // generation, so this branch only fires on unexpected state.
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
    if (archivePuzzle === undefined) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
      };
    }

    // Handle null result (puzzle not found)
    if (archivePuzzle === null) {
      return {
        puzzle: null,
        isLoading: false,
        error: new Error(`Puzzle #${puzzleNumber} not found`),
      };
    }

    // Normalize the puzzle data
    const normalizedPuzzle: PuzzleWithContext = {
      id: archivePuzzle._id as Id<"puzzles">,
      targetYear: archivePuzzle.targetYear,
      events: archivePuzzle.events,
      puzzleNumber: archivePuzzle.puzzleNumber,
      historicalContext: archivePuzzle.historicalContext,
    };

    return {
      puzzle: normalizedPuzzle,
      isLoading: false,
      error: null,
    };
  }, [isDaily, todaysPuzzle, archivePuzzle, puzzleNumber]);
}
