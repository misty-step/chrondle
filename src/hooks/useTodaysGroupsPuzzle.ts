"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Id } from "convex/_generated/dataModel";
import { anyPublicApi } from "@/lib/convexAnyApi";
import { getLocalDateString } from "@/lib/time/dailyDate";
import { logger } from "@/lib/logger";
import { useOnTabFocus } from "@/hooks/useVisibilityChange";
import type { GroupsBoardCard, GroupsRevealedGroup } from "@/types/groupsGameState";

interface ConvexGroupsPuzzle {
  _id: string;
  date: string;
  puzzleNumber: number;
  board: GroupsBoardCard[];
  groups: GroupsRevealedGroup[];
  seed: string;
}

export interface TodaysGroupsPuzzle {
  id: Id<"groupsPuzzles">;
  date: string;
  puzzleNumber: number;
  board: GroupsBoardCard[];
  groups: GroupsRevealedGroup[];
  seed: string;
}

interface UseTodaysGroupsPuzzleOptions {
  preloadedPuzzle?: ConvexGroupsPuzzle | null;
}

interface UseTodaysGroupsPuzzleReturn {
  puzzle: TodaysGroupsPuzzle | null;
  isLoading: boolean;
  error: string | null;
  localDate: string;
  revalidate: () => void;
}

const DATE_CHECK_INTERVAL = 30_000;

export function useTodaysGroupsPuzzle(
  options: UseTodaysGroupsPuzzleOptions = {},
): UseTodaysGroupsPuzzleReturn {
  const { preloadedPuzzle } = options;
  const [localDate, setLocalDate] = useState(() => getLocalDateString());
  const generationTriggeredForRef = useRef<string | null>(null);

  const preloadMatchesLocalDate = useMemo(() => {
    return preloadedPuzzle?.date === localDate;
  }, [preloadedPuzzle, localDate]);

  const puzzleByDate = useQuery(
    anyPublicApi.groupsPuzzles.getGroupsPuzzleByDate,
    preloadMatchesLocalDate ? "skip" : { date: localDate },
  ) as ConvexGroupsPuzzle | null | undefined;

  const ensurePuzzleForDate = useMutation(
    anyPublicApi.groupsPuzzles.ensureGroupsPuzzleForDate,
  ) as (args: { date: string }) => Promise<unknown>;

  useEffect(() => {
    if (
      !preloadMatchesLocalDate &&
      puzzleByDate === null &&
      generationTriggeredForRef.current !== localDate
    ) {
      generationTriggeredForRef.current = localDate;
      ensurePuzzleForDate({ date: localDate }).catch((error: unknown) => {
        logger.error("[useTodaysGroupsPuzzle] Failed to ensure puzzle:", error);
        generationTriggeredForRef.current = null;
      });
    }
  }, [ensurePuzzleForDate, localDate, preloadMatchesLocalDate, puzzleByDate]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextDate = getLocalDateString();
      if (nextDate !== localDate) {
        setLocalDate(nextDate);
      }
    }, DATE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [localDate]);

  const updateLocalDate = useCallback(() => {
    const nextDate = getLocalDateString();
    if (nextDate !== localDate) {
      setLocalDate(nextDate);
    }
  }, [localDate]);

  useOnTabFocus(updateLocalDate);

  const revalidate = useCallback(() => {
    updateLocalDate();
  }, [updateLocalDate]);

  return useMemo<UseTodaysGroupsPuzzleReturn>(() => {
    const sourcePuzzle =
      preloadMatchesLocalDate && preloadedPuzzle ? preloadedPuzzle : (puzzleByDate ?? null);

    if (sourcePuzzle === undefined || sourcePuzzle === null) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
        localDate,
        revalidate,
      };
    }

    return {
      puzzle: {
        id: sourcePuzzle._id as Id<"groupsPuzzles">,
        date: sourcePuzzle.date,
        puzzleNumber: sourcePuzzle.puzzleNumber,
        board: sourcePuzzle.board,
        groups: sourcePuzzle.groups,
        seed: sourcePuzzle.seed,
      },
      isLoading: false,
      error: null,
      localDate,
      revalidate,
    };
  }, [localDate, preloadMatchesLocalDate, preloadedPuzzle, puzzleByDate, revalidate]);
}
