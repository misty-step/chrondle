"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { anyPublicApi } from "@/lib/convexAnyApi";
import { useTodaysGroupsPuzzle } from "@/hooks/useTodaysGroupsPuzzle";
import type { GroupsBoardCard, GroupsPuzzle, GroupsRevealedGroup } from "@/types/groupsGameState";

interface ConvexGroupsPuzzle {
  _id: string;
  date: string;
  puzzleNumber: number;
  board: GroupsBoardCard[];
  groups: GroupsRevealedGroup[];
  seed: string;
}

interface UseGroupsPuzzleDataReturn {
  puzzle: GroupsPuzzle | null;
  isLoading: boolean;
  error: Error | null;
}

export function useGroupsPuzzleData(
  puzzleNumber?: number,
  initialData?: unknown,
): UseGroupsPuzzleDataReturn {
  const isDaily = puzzleNumber === undefined;

  const todaysPuzzle = useTodaysGroupsPuzzle(
    isDaily ? { preloadedPuzzle: initialData as ConvexGroupsPuzzle | null | undefined } : {},
  );

  const archiveInitialData = !isDaily
    ? (initialData as ConvexGroupsPuzzle | null | undefined)
    : null;
  const archiveInitialMatchesPuzzle =
    archiveInitialData && archiveInitialData.puzzleNumber === puzzleNumber;

  const archivePuzzle = useQuery(
    anyPublicApi.groupsPuzzles.getGroupsPuzzleByNumber,
    !isDaily && !archiveInitialMatchesPuzzle ? { puzzleNumber } : "skip",
  ) as ConvexGroupsPuzzle | null | undefined;

  const archiveData = archiveInitialMatchesPuzzle ? archiveInitialData : archivePuzzle;

  return useMemo<UseGroupsPuzzleDataReturn>(() => {
    if (isDaily) {
      if (todaysPuzzle.isLoading) {
        return { puzzle: null, isLoading: true, error: null };
      }

      if (todaysPuzzle.error) {
        return { puzzle: null, isLoading: false, error: new Error(todaysPuzzle.error) };
      }

      if (!todaysPuzzle.puzzle) {
        return {
          puzzle: null,
          isLoading: false,
          error: new Error("No daily Groups puzzle available"),
        };
      }

      return { puzzle: todaysPuzzle.puzzle, isLoading: false, error: null };
    }

    if (archiveData === undefined) {
      return { puzzle: null, isLoading: true, error: null };
    }

    if (archiveData === null) {
      return {
        puzzle: null,
        isLoading: false,
        error: new Error(`Groups puzzle #${puzzleNumber} not found`),
      };
    }

    return {
      puzzle: normalizePuzzle(archiveData),
      isLoading: false,
      error: null,
    };
  }, [archiveData, isDaily, puzzleNumber, todaysPuzzle]);
}

function normalizePuzzle(convexPuzzle: ConvexGroupsPuzzle): GroupsPuzzle {
  return {
    id: convexPuzzle._id as Id<"groupsPuzzles">,
    date: convexPuzzle.date,
    puzzleNumber: convexPuzzle.puzzleNumber,
    board: convexPuzzle.board,
    groups: convexPuzzle.groups,
    seed: convexPuzzle.seed,
  };
}
