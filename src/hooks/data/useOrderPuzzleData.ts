"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle } from "@/types/orderGameState";
import { useTodaysOrderPuzzle } from "@/hooks/useTodaysOrderPuzzle";

interface ConvexOrderEvent {
  id: string;
  year: number;
  text: string;
}

interface ConvexOrderPuzzle {
  _id: string;
  date: string;
  puzzleNumber: number;
  events: ConvexOrderEvent[];
  seed: string;
}

interface UseOrderPuzzleDataReturn {
  puzzle: OrderPuzzle | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch Order puzzle data from Convex
 *
 * This hook handles two modes:
 * 1. Daily puzzle (no puzzleNumber): Delegates to useTodaysOrderPuzzle for proper
 *    local date handling, visibility change detection, and preload validation.
 * 2. Archive puzzle (with puzzleNumber): Fetches specific puzzle by number.
 *
 * For daily puzzles, this ensures users see "today's puzzle" based on their
 * LOCAL timezone, not UTC. Preloaded data from SSR is validated against the
 * client's local date before being used.
 */
export function useOrderPuzzleData(
  puzzleNumber?: number,
  initialData?: unknown,
): UseOrderPuzzleDataReturn {
  const isDaily = puzzleNumber === undefined;

  // For daily puzzles, use the new useTodaysOrderPuzzle hook which handles:
  // - Local date as source of truth
  // - Preload validation against local date
  // - Visibility change detection (tab focus)
  // - Midnight rollover detection
  const todaysPuzzle = useTodaysOrderPuzzle(
    isDaily ? { preloadedPuzzle: initialData as ConvexOrderPuzzle | null | undefined } : {},
  );

  // For archive puzzles, check if initial data matches requested puzzle number
  const archiveInitialData = !isDaily
    ? (initialData as ConvexOrderPuzzle | null | undefined)
    : null;
  const archiveInitialMatchesPuzzle =
    archiveInitialData && archiveInitialData.puzzleNumber === puzzleNumber;

  // For archive puzzles, fetch by puzzle number (skip if we already have matching initial data)
  const archivePuzzle = useQuery(
    api.orderPuzzles.getOrderPuzzleByNumber,
    !isDaily && !archiveInitialMatchesPuzzle ? { puzzleNumber } : "skip",
  ) as ConvexOrderPuzzle | null | undefined;

  // Use initial data if it matches, otherwise use query result
  const archiveData = archiveInitialMatchesPuzzle ? archiveInitialData : archivePuzzle;

  return useMemo<UseOrderPuzzleDataReturn>(() => {
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

      // Defensive: useTodaysOrderPuzzle returns isLoading=true while triggering on-demand
      // generation, so this branch only fires on unexpected state (e.g., generation
      // mutation fails silently without setting error). Kept for robustness.
      if (!todaysPuzzle.puzzle) {
        return {
          puzzle: null,
          isLoading: false,
          error: new Error("No daily Order puzzle available"),
        };
      }

      // Convert TodaysOrderPuzzle to OrderPuzzle
      const normalizedPuzzle: OrderPuzzle = {
        id: todaysPuzzle.puzzle.id,
        date: todaysPuzzle.puzzle.date,
        puzzleNumber: todaysPuzzle.puzzle.puzzleNumber,
        events: todaysPuzzle.puzzle.events,
        seed: todaysPuzzle.puzzle.seed,
      };

      return {
        puzzle: normalizedPuzzle,
        isLoading: false,
        error: null,
      };
    }

    // === ARCHIVE PUZZLE MODE ===

    if (archiveData === undefined) {
      return { puzzle: null, isLoading: true, error: null };
    }

    if (archiveData === null) {
      return {
        puzzle: null,
        isLoading: false,
        error: new Error(`Order puzzle #${puzzleNumber} not found`),
      };
    }

    return {
      puzzle: normalizePuzzle(archiveData),
      isLoading: false,
      error: null,
    };
  }, [isDaily, todaysPuzzle, archiveData, puzzleNumber]);
}

function normalizePuzzle(convexPuzzle: ConvexOrderPuzzle): OrderPuzzle {
  return {
    id: convexPuzzle._id as Id<"orderPuzzles">,
    date: convexPuzzle.date,
    puzzleNumber: convexPuzzle.puzzleNumber,
    events: convexPuzzle.events.map((event) => ({
      id: event.id,
      year: event.year,
      text: event.text,
    })),
    seed: convexPuzzle.seed,
  };
}
