"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { safeConvexId } from "@/lib/validation";
import type { Id } from "convex/_generated/dataModel";
import type { OrderHint, OrderScore } from "@/types/orderGameState";
import type { OrderProgressData } from "@/lib/deriveOrderGameState";

interface ConvexOrderPlay {
  _id: Id<"orderPlays">;
  userId: Id<"users">;
  puzzleId: Id<"orderPuzzles">;
  ordering: string[];
  hints: OrderHint[];
  completedAt?: number | null;
  updatedAt: number;
  score?: OrderScore | null;
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
  // @ts-expect-error - orderPuzzles table exists in schema but types haven't regenerated
  const validPuzzleId = safeConvexId(puzzleId, "orderPuzzles");

  const shouldQuery = validUserId !== null && validPuzzleId !== null;

  const convexPlay = useQuery(
    api.orderPlays.getOrderPlay,
    shouldQuery
      ? {
          userId: validUserId as Id<"users">,
          // @ts-expect-error - orderPuzzles table exists in schema but types haven't regenerated
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
      hints: convexPlay.hints ?? [],
      completedAt: convexPlay.completedAt ?? null,
      score: convexPlay.score ?? null,
    };

    return {
      progress: normalized,
      isLoading: false,
    };
  }, [convexPlay, shouldQuery]);
}
