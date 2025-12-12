"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle } from "@/types/orderGameState";
import { getLocalDateString } from "@/lib/time/dailyDate";
import { logger } from "@/lib/logger";

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
 * Local Date Selection: For daily puzzles, this hook uses the client's local date
 * to determine which puzzle to fetch. This ensures users see "today's puzzle"
 * based on their timezone, not UTC.
 */
export function useOrderPuzzleData(
  puzzleNumber?: number,
  initialData?: unknown,
): UseOrderPuzzleDataReturn {
  const hasInitialData = initialData !== undefined;

  // Compute local date for daily puzzle selection
  const [localDate, setLocalDate] = useState(() => getLocalDateString());

  // Update local date when it changes (midnight boundary)
  useEffect(() => {
    const checkDate = () => {
      const currentDate = getLocalDateString();
      if (currentDate !== localDate) {
        setLocalDate(currentDate);
      }
    };

    const interval = setInterval(checkDate, 60000);
    return () => clearInterval(interval);
  }, [localDate]);

  // Daily mode: fetch puzzle by local date
  const isDaily = puzzleNumber === undefined && !hasInitialData;
  const localPuzzle = useQuery(
    api.orderPuzzles.getOrderPuzzleByDate,
    isDaily ? { date: localDate } : "skip",
  ) as ConvexOrderPuzzle | null | undefined;

  const archivePuzzle = useQuery(
    api.orderPuzzles.getOrderPuzzleByNumber,
    puzzleNumber !== undefined && !hasInitialData ? { puzzleNumber } : "skip",
  ) as ConvexOrderPuzzle | null | undefined;

  // Mutation for on-demand puzzle generation with date support
  const ensurePuzzleForDate = useMutation(api.orderPuzzles.ensureOrderPuzzleForDate);

  useEffect(() => {
    if (isDaily && localPuzzle === null) {
      logger.warn(
        `[useOrderPuzzleData] No Order puzzle found for local date ${localDate}, triggering ensure`,
      );
      ensurePuzzleForDate({ date: localDate }).catch((err) => {
        logger.error("[useOrderPuzzleData] Failed ensuring Order puzzle for date", err);
      });
    }
  }, [localPuzzle, isDaily, localDate, ensurePuzzleForDate]);

  const convexPuzzle = hasInitialData
    ? (initialData as ConvexOrderPuzzle | null | undefined)
    : puzzleNumber !== undefined
      ? archivePuzzle
      : localPuzzle;

  return useMemo<UseOrderPuzzleDataReturn>(() => {
    if (hasInitialData) {
      if (initialData === null) {
        return {
          puzzle: null,
          isLoading: false,
          error:
            puzzleNumber !== undefined
              ? new Error(`Order puzzle #${puzzleNumber} not found`)
              : new Error("No daily Order puzzle available"),
        };
      }

      return {
        puzzle: normalizePuzzle(initialData as ConvexOrderPuzzle),
        isLoading: false,
        error: null,
      };
    }

    if (convexPuzzle === undefined) {
      return { puzzle: null, isLoading: true, error: null };
    }

    if (convexPuzzle === null) {
      return {
        puzzle: null,
        isLoading: false,
        error:
          puzzleNumber !== undefined
            ? new Error(`Order puzzle #${puzzleNumber} not found`)
            : new Error("No daily Order puzzle available"),
      };
    }

    return {
      puzzle: normalizePuzzle(convexPuzzle),
      isLoading: false,
      error: null,
    };
  }, [convexPuzzle, hasInitialData, initialData, puzzleNumber]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePuzzle(convexPuzzle: any): OrderPuzzle {
  return {
    id: (convexPuzzle._id || convexPuzzle.id) as Id<"orderPuzzles">,
    date: convexPuzzle.date,
    puzzleNumber: convexPuzzle.puzzleNumber,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: convexPuzzle.events.map((event: any) => ({
      id: event.id,
      year: event.year,
      text: event.text,
    })),
    seed: convexPuzzle.seed,
  };
}
