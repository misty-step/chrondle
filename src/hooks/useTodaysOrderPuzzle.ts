"use client";

/**
 * useTodaysOrderPuzzle - Deep Module for Daily Order Puzzle Selection
 *
 * This hook is the SINGLE SOURCE OF TRUTH for "what Order puzzle should the user see today?"
 *
 * Design Principles (Ousterhout's Philosophy of Software Design):
 * - Deep Module: Simple interface, complex implementation hidden
 * - Single Responsibility: Only answers "what's today's Order puzzle?"
 * - Local Date is King: Client's local date determines puzzle, never UTC
 *
 * Key Behaviors:
 * 1. Uses client's LOCAL date to determine which puzzle to fetch
 * 2. Validates preloaded data against local date (SSR may use UTC)
 * 3. Re-validates on tab visibility change (handles overnight tabs)
 * 4. Auto-detects midnight rollover and fetches new puzzle
 * 5. Triggers on-demand generation if puzzle doesn't exist
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { getLocalDateString } from "@/lib/time/dailyDate";
import { useOnTabFocus } from "@/hooks/useVisibilityChange";
import { logger } from "@/lib/logger";

/**
 * Event structure in Order puzzle
 */
interface OrderEvent {
  id: string;
  year: number;
  text: string;
}

/**
 * Order puzzle data structure from Convex
 */
interface ConvexOrderPuzzle {
  _id: string;
  date: string;
  puzzleNumber: number;
  events: OrderEvent[];
  seed: string;
}

/**
 * Normalized Order puzzle structure for consumers
 */
export interface TodaysOrderPuzzle {
  id: Id<"orderPuzzles">;
  date: string;
  puzzleNumber: number;
  events: OrderEvent[];
  seed: string;
}

/**
 * Return type for useTodaysOrderPuzzle hook
 */
export interface UseTodaysOrderPuzzleReturn {
  puzzle: TodaysOrderPuzzle | null;
  isLoading: boolean;
  error: string | null;
  localDate: string;
  usedPreload: boolean;
  revalidate: () => void;
}

/**
 * Options for useTodaysOrderPuzzle
 */
export interface UseTodaysOrderPuzzleOptions {
  preloadedPuzzle?: ConvexOrderPuzzle | null;
}

const DATE_CHECK_INTERVAL = 30_000;

export function useTodaysOrderPuzzle(
  options: UseTodaysOrderPuzzleOptions = {},
): UseTodaysOrderPuzzleReturn {
  const { preloadedPuzzle } = options;

  // === STATE ===
  const [localDate, setLocalDate] = useState(() => getLocalDateString());
  const [usedPreload, setUsedPreload] = useState(false);
  const prevLocalDateRef = useRef(localDate);

  // === DERIVED: Should we use preloaded data? ===
  const preloadMatchesLocalDate = useMemo(() => {
    if (!preloadedPuzzle?.date) return false;
    return preloadedPuzzle.date === localDate;
  }, [preloadedPuzzle, localDate]);

  // === QUERIES ===
  const shouldQueryByDate = !preloadMatchesLocalDate;

  const puzzleByDate = useQuery(
    api.orderPuzzles.getOrderPuzzleByDate,
    shouldQueryByDate ? { date: localDate } : "skip",
  ) as ConvexOrderPuzzle | null | undefined;

  const ensurePuzzleForDate = useMutation(api.orderPuzzles.ensureOrderPuzzleForDate);

  // === TRIGGER ON-DEMAND GENERATION ===
  useEffect(() => {
    if (shouldQueryByDate && puzzleByDate === null) {
      logger.warn(
        `[useTodaysOrderPuzzle] No puzzle for local date ${localDate}, triggering ensure`,
      );

      ensurePuzzleForDate({ date: localDate }).catch((error: unknown) => {
        logger.error("[useTodaysOrderPuzzle] Failed to ensure puzzle:", error);
      });
    }
  }, [puzzleByDate, shouldQueryByDate, localDate, ensurePuzzleForDate]);

  // === DATE CHANGE DETECTION ===
  useEffect(() => {
    const checkDate = () => {
      const currentDate = getLocalDateString();
      if (currentDate !== localDate) {
        logger.info(`[useTodaysOrderPuzzle] Date changed: ${localDate} → ${currentDate}`);
        setLocalDate(currentDate);
      }
    };

    const interval = setInterval(checkDate, DATE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [localDate]);

  // === VISIBILITY CHANGE HANDLER ===
  const handleTabFocus = useCallback(() => {
    const currentDate = getLocalDateString();
    if (currentDate !== localDate) {
      logger.info(
        `[useTodaysOrderPuzzle] Tab focused, date changed: ${localDate} → ${currentDate}`,
      );
      setLocalDate(currentDate);
    }
  }, [localDate]);

  useOnTabFocus(handleTabFocus);

  // === MANUAL REVALIDATE ===
  const revalidate = useCallback(() => {
    const currentDate = getLocalDateString();
    if (currentDate !== localDate) {
      logger.info(
        `[useTodaysOrderPuzzle] Manual revalidate, date changed: ${localDate} → ${currentDate}`,
      );
      setLocalDate(currentDate);
    }
  }, [localDate]);

  // === DETERMINE FINAL PUZZLE ===
  const dateJustChanged = prevLocalDateRef.current !== localDate;
  useEffect(() => {
    prevLocalDateRef.current = localDate;
  }, [localDate]);

  const result = useMemo<UseTodaysOrderPuzzleReturn>(() => {
    if (dateJustChanged) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
        localDate,
        usedPreload: false,
        revalidate,
      };
    }

    if (preloadMatchesLocalDate && preloadedPuzzle) {
      if (!usedPreload) {
        setUsedPreload(true);
      }

      const normalizedPuzzle: TodaysOrderPuzzle = {
        id: preloadedPuzzle._id as Id<"orderPuzzles">,
        date: preloadedPuzzle.date,
        puzzleNumber: preloadedPuzzle.puzzleNumber,
        events: preloadedPuzzle.events,
        seed: preloadedPuzzle.seed,
      };

      return {
        puzzle: normalizedPuzzle,
        isLoading: false,
        error: null,
        localDate,
        usedPreload: true,
        revalidate,
      };
    }

    if (puzzleByDate === undefined) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
        localDate,
        usedPreload: false,
        revalidate,
      };
    }

    if (puzzleByDate === null) {
      return {
        puzzle: null,
        isLoading: true,
        error: null,
        localDate,
        usedPreload: false,
        revalidate,
      };
    }

    const normalizedPuzzle: TodaysOrderPuzzle = {
      id: puzzleByDate._id as Id<"orderPuzzles">,
      date: puzzleByDate.date,
      puzzleNumber: puzzleByDate.puzzleNumber,
      events: puzzleByDate.events,
      seed: puzzleByDate.seed,
    };

    return {
      puzzle: normalizedPuzzle,
      isLoading: false,
      error: null,
      localDate,
      usedPreload: false,
      revalidate,
    };
  }, [
    preloadMatchesLocalDate,
    preloadedPuzzle,
    puzzleByDate,
    localDate,
    usedPreload,
    dateJustChanged,
    revalidate,
  ]);

  useEffect(() => {
    if (preloadedPuzzle?.date && !preloadMatchesLocalDate) {
      logger.warn(
        `[useTodaysOrderPuzzle] Preload date mismatch: preload=${preloadedPuzzle.date}, local=${localDate}`,
      );
    }
  }, [preloadedPuzzle?.date, preloadMatchesLocalDate, localDate]);

  return result;
}
