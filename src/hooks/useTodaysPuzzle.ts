"use client";

/**
 * useTodaysPuzzle - Deep Module for Daily Puzzle Selection
 *
 * This hook is the SINGLE SOURCE OF TRUTH for "what puzzle should the user see today?"
 *
 * Design Principles (Ousterhout's Philosophy of Software Design):
 * - Deep Module: Simple interface, complex implementation hidden
 * - Single Responsibility: Only answers "what's today's puzzle?"
 * - Local Date is King: Client's local date determines puzzle, never UTC
 *
 * Key Behaviors:
 * 1. Uses client's LOCAL date to determine which puzzle to fetch
 * 2. Validates preloaded data against local date (SSR may use UTC)
 * 3. Re-validates on tab visibility change (handles overnight tabs)
 * 4. Auto-detects midnight rollover and fetches new puzzle
 * 5. Triggers on-demand generation if puzzle doesn't exist
 *
 * The Puzzle Contract:
 * - User in Tokyo at 9am Dec 22 local → sees Dec 22 puzzle
 * - User in NYC at 9am Dec 22 local → sees Dec 22 puzzle
 * - Both see THEIR local date's puzzle, regardless of server UTC time
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { getLocalDateString } from "@/lib/time/dailyDate";
import { useOnTabFocus } from "@/hooks/useVisibilityChange";
import { logger } from "@/lib/logger";

/**
 * Puzzle data structure from Convex
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
 * Normalized puzzle structure for consumers
 */
export interface TodaysPuzzle {
  id: Id<"puzzles">;
  targetYear: number;
  events: string[];
  puzzleNumber: number;
  date: string;
  historicalContext?: string;
}

/**
 * Return type for useTodaysPuzzle hook
 */
export interface UseTodaysPuzzleReturn {
  /** The puzzle for today's local date, or null if loading/error */
  puzzle: TodaysPuzzle | null;
  /** True while fetching puzzle data */
  isLoading: boolean;
  /** Error message if puzzle fetch failed */
  error: string | null;
  /** Current local date being used (for debugging) */
  localDate: string;
  /** Whether preloaded data was used (for debugging) */
  usedPreload: boolean;
  /** Force re-check of local date and refetch if changed */
  revalidate: () => void;
}

/**
 * Options for useTodaysPuzzle
 */
export interface UseTodaysPuzzleOptions {
  /**
   * Optional preloaded puzzle data from SSR.
   * Will be validated against local date - if mismatch, correct puzzle is fetched.
   */
  preloadedPuzzle?: ConvexPuzzle | null;
}

/**
 * How often to check for date changes (in ms)
 * Check every 30 seconds to catch midnight more quickly than before
 */
const DATE_CHECK_INTERVAL = 30_000;

export function useTodaysPuzzle(options: UseTodaysPuzzleOptions = {}): UseTodaysPuzzleReturn {
  const { preloadedPuzzle } = options;

  // === STATE ===

  // Local date is the SINGLE SOURCE OF TRUTH
  const [localDate, setLocalDate] = useState(() => getLocalDateString());

  // Track if we've used the preload (for debugging/analytics)
  const [usedPreload, setUsedPreload] = useState(false);

  // Track the previous local date to detect changes
  const prevLocalDateRef = useRef(localDate);

  // === DERIVED: Should we use preloaded data? ===

  // Only use preload if it exists AND matches local date
  const preloadMatchesLocalDate = useMemo(() => {
    if (!preloadedPuzzle?.date) return false;
    return preloadedPuzzle.date === localDate;
  }, [preloadedPuzzle, localDate]);

  // === QUERIES ===

  // Query for puzzle by local date
  // Skip if preload matches (optimization) - but always have this as fallback
  const shouldQueryByDate = !preloadMatchesLocalDate;

  const puzzleByDate = useQuery(
    api.puzzles.getPuzzleByDate,
    shouldQueryByDate ? { date: localDate } : "skip",
  );

  // Mutation for on-demand puzzle generation
  const ensurePuzzleForDate = useMutation(api.puzzles.ensurePuzzleForDate);

  // Track which date we've already triggered generation for (prevents duplicate calls)
  const generationTriggeredForRef = useRef<string | null>(null);

  // === TRIGGER ON-DEMAND GENERATION ===

  useEffect(() => {
    // Only trigger if we queried and got null (puzzle doesn't exist)
    // Also check ref to prevent duplicate mutation calls before query updates
    if (
      shouldQueryByDate &&
      puzzleByDate === null &&
      generationTriggeredForRef.current !== localDate
    ) {
      generationTriggeredForRef.current = localDate;
      logger.warn(`[useTodaysPuzzle] No puzzle for local date ${localDate}, triggering ensure`);

      ensurePuzzleForDate({ date: localDate }).catch((error: unknown) => {
        // Log but don't break - could be outside window
        logger.error("[useTodaysPuzzle] Failed to ensure puzzle:", error);
        // Reset so retry is possible on next effect run
        generationTriggeredForRef.current = null;
      });
    }
  }, [puzzleByDate, shouldQueryByDate, localDate, ensurePuzzleForDate]);

  // === DATE CHANGE DETECTION ===

  // Check for date changes periodically (handles midnight rollover)
  useEffect(() => {
    const checkDate = () => {
      const currentDate = getLocalDateString();
      if (currentDate !== localDate) {
        logger.info(`[useTodaysPuzzle] Date changed: ${localDate} → ${currentDate}`);
        setLocalDate(currentDate);
      }
    };

    const interval = setInterval(checkDate, DATE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [localDate]);

  // === VISIBILITY CHANGE HANDLER ===

  // When tab becomes visible, re-check the date
  // This handles the case where user left tab open overnight
  const handleTabFocus = useCallback(() => {
    const currentDate = getLocalDateString();
    if (currentDate !== localDate) {
      logger.info(`[useTodaysPuzzle] Tab focused, date changed: ${localDate} → ${currentDate}`);
      setLocalDate(currentDate);
    }
  }, [localDate]);

  useOnTabFocus(handleTabFocus);

  // === MANUAL REVALIDATE ===

  const revalidate = useCallback(() => {
    const currentDate = getLocalDateString();
    if (currentDate !== localDate) {
      logger.info(
        `[useTodaysPuzzle] Manual revalidate, date changed: ${localDate} → ${currentDate}`,
      );
      setLocalDate(currentDate);
    }
  }, [localDate]);

  // === DETERMINE FINAL PUZZLE ===

  // Track if date just changed (to force loading state)
  const dateJustChanged = prevLocalDateRef.current !== localDate;
  useEffect(() => {
    prevLocalDateRef.current = localDate;
  }, [localDate]);

  const result = useMemo<UseTodaysPuzzleReturn>(() => {
    // If date just changed, show loading while we fetch new puzzle
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

    // If preload matches local date, use it
    if (preloadMatchesLocalDate && preloadedPuzzle) {
      const normalizedPuzzle: TodaysPuzzle = {
        id: preloadedPuzzle._id as Id<"puzzles">,
        targetYear: preloadedPuzzle.targetYear,
        events: preloadedPuzzle.events,
        puzzleNumber: preloadedPuzzle.puzzleNumber,
        date: preloadedPuzzle.date || localDate,
        historicalContext: preloadedPuzzle.historicalContext,
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

    // Otherwise, use query result
    if (puzzleByDate === undefined) {
      // Still loading
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
      // Puzzle doesn't exist (yet) - ensurePuzzleForDate was triggered
      return {
        puzzle: null,
        isLoading: true, // Still waiting for generation
        error: null,
        localDate,
        usedPreload: false,
        revalidate,
      };
    }

    // Got puzzle from query
    const normalizedPuzzle: TodaysPuzzle = {
      id: puzzleByDate._id as Id<"puzzles">,
      targetYear: puzzleByDate.targetYear,
      events: puzzleByDate.events,
      puzzleNumber: puzzleByDate.puzzleNumber,
      date: puzzleByDate.date || localDate,
      historicalContext: puzzleByDate.historicalContext,
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
    dateJustChanged,
    revalidate,
  ]);

  // Track preload usage as a side effect (cannot be inside useMemo)
  useEffect(() => {
    if (preloadMatchesLocalDate && preloadedPuzzle && !usedPreload) {
      setUsedPreload(true);
    }
  }, [preloadMatchesLocalDate, preloadedPuzzle, usedPreload]);

  // Log when preload doesn't match (debugging timezone issues)
  useEffect(() => {
    if (preloadedPuzzle?.date && !preloadMatchesLocalDate) {
      logger.warn(
        `[useTodaysPuzzle] Preload date mismatch: preload=${preloadedPuzzle.date}, local=${localDate}`,
      );
    }
  }, [preloadedPuzzle?.date, preloadMatchesLocalDate, localDate]);

  return result;
}
