"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle, OrderEvent } from "@/types/orderGameState";
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

export function useOrderPuzzleData(
  puzzleNumber?: number,
  initialData?: unknown,
): UseOrderPuzzleDataReturn {
  const hasInitialData = initialData !== undefined;

  const dailyPuzzle = useQuery(
    api.orderPuzzles.getDailyOrderPuzzle,
    puzzleNumber !== undefined || hasInitialData ? "skip" : undefined,
  ) as ConvexOrderPuzzle | null | undefined;

  const archivePuzzle = useQuery(
    api.orderPuzzles.getOrderPuzzleByNumber,
    puzzleNumber !== undefined && !hasInitialData ? { puzzleNumber } : "skip",
  ) as ConvexOrderPuzzle | null | undefined;

  const ensurePuzzle = useMutation(api.orderPuzzles.ensureTodaysOrderPuzzle);

  useEffect(() => {
    if (puzzleNumber === undefined && !hasInitialData && dailyPuzzle === null) {
      logger.warn("[useOrderPuzzleData] No daily Order puzzle found, triggering generation");
      ensurePuzzle().catch((err) => {
        logger.error("[useOrderPuzzleData] Failed generating Order puzzle", err);
      });
    }
  }, [dailyPuzzle, hasInitialData, puzzleNumber, ensurePuzzle]);

  const convexPuzzle = hasInitialData
    ? (initialData as ConvexOrderPuzzle | null | undefined)
    : puzzleNumber !== undefined
      ? archivePuzzle
      : dailyPuzzle;

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

function normalizePuzzle(convexPuzzle: ConvexOrderPuzzle): OrderPuzzle {
  return {
    id: convexPuzzle._id as Id<"orderPuzzles">,
    date: convexPuzzle.date,
    puzzleNumber: convexPuzzle.puzzleNumber,
    events: convexPuzzle.events.map<OrderEvent>((event) => ({
      id: event.id,
      year: event.year,
      text: event.text,
    })),
    seed: convexPuzzle.seed,
  };
}
