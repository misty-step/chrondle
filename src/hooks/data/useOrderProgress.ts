"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { safeConvexId } from "@/lib/validation";
import type { Id } from "convex/_generated/dataModel";
import type { GolfScore, OrderAttempt } from "@/types/orderGameState";
import type { OrderProgressData } from "@/lib/deriveOrderGameState";

/**
 * Shape of the Order play record from Convex.
 * Updated for golf mode (attempts instead of hints).
 */
interface ConvexOrderPlay {
  _id: Id<"orderPlays">;
  userId: Id<"users">;
  puzzleId: Id<"orderPuzzles">;
  ordering: string[];
  attempts: OrderAttempt[];
  completedAt?: number | null;
  updatedAt: number;
  score?: GolfScore | null;
}

interface UseOrderProgressReturn {
  progress: OrderProgressData | null;
  isLoading: boolean;
}

export function useOrderProgress(
  userId: string | null,
  puzzleId: string | null,
): UseOrderProgressReturn {
  const validUserId = safeConvexId(userId, "users");
  const validPuzzleId = safeConvexId(puzzleId, "orderPuzzles");

  const shouldQuery = validUserId !== null && validPuzzleId !== null;

  const convexPlay = useQuery(
    api.orderPlays.getOrderPlay,
    shouldQuery
      ? {
          userId: validUserId as Id<"users">,
          puzzleId: validPuzzleId as Id<"orderPuzzles">,
        }
      : "skip",
  ) as ConvexOrderPlay | null | undefined;

  return useMemo<UseOrderProgressReturn>(() => {
    if (!shouldQuery) {
      return { progress: null, isLoading: false };
    }

    if (convexPlay === undefined) {
      return { progress: null, isLoading: true };
    }

    if (convexPlay === null) {
      return { progress: null, isLoading: false };
    }

    const normalized: OrderProgressData = {
      ordering: convexPlay.ordering ?? [],
      attempts: convexPlay.attempts ?? [],
      completedAt: convexPlay.completedAt ?? null,
      score: convexPlay.score ?? null,
    };

    return {
      progress: normalized,
      isLoading: false,
    };
  }, [convexPlay, shouldQuery]);
}
