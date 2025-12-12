"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  calculateCountdownTime,
  shouldTriggerCompletion,
  didCountdownRestart,
} from "@/lib/time/countdownCalculation";
import { getMillisUntilLocalMidnight } from "@/lib/time/dailyDate";
import { logger } from "@/lib/logger";

export interface UseCountdownReturn {
  timeString: string;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Countdown strategy determines the target time source
 *
 * - "localMidnight": Uses client's local midnight (primary for daily puzzles)
 * - "serverMidnight": Uses Convex getCronSchedule (legacy behavior)
 */
export type CountdownStrategy = "localMidnight" | "serverMidnight";

export interface UseCountdownOptions {
  /**
   * Countdown strategy - determines target time source
   * Default: "localMidnight" (new behavior for daily unlock)
   */
  strategy?: CountdownStrategy;

  /**
   * Target timestamp (Unix milliseconds) to countdown to.
   * If provided, overrides both strategy and query.
   * Still supported for archive/testing scenarios.
   */
  targetTimestamp?: number;

  /**
   * Whether to use fallback local midnight calculation
   * when server strategy fails. Defaults to true.
   * Only relevant for "serverMidnight" strategy.
   */
  enableFallback?: boolean;
}

export function useCountdown(options: UseCountdownOptions = {}): UseCountdownReturn {
  const { strategy = "localMidnight", targetTimestamp, enableFallback = true } = options;

  const [timeString, setTimeString] = useState("00:00:00");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only fetch cron schedule if using serverMidnight strategy and no explicit target
  const shouldQueryServer = strategy === "serverMidnight" && !targetTimestamp;
  const cronSchedule = useQuery(api.puzzles.getCronSchedule, shouldQueryServer ? {} : "skip");

  // Calculate effective target timestamp based on strategy
  let effectiveTarget: number | undefined;
  let isLoading = false;

  if (targetTimestamp) {
    // Explicit target takes precedence
    effectiveTarget = targetTimestamp;
  } else if (strategy === "localMidnight") {
    // Local midnight strategy: compute from client time (never loading)
    effectiveTarget = Date.now() + getMillisUntilLocalMidnight();
  } else {
    // Server midnight strategy: use cron schedule
    effectiveTarget = cronSchedule?.nextScheduledTime;
    isLoading = cronSchedule === undefined;
  }

  // Reset completion state when target changes
  useEffect(() => {
    if (effectiveTarget && isComplete) {
      setIsComplete(false);
      logger.warn("[useCountdown] New target detected, resetting completion state");
    }
  }, [effectiveTarget, isComplete]);

  useEffect(() => {
    if (isLoading) {
      setTimeString("00:00:00");
      return;
    }

    const updateCountdown = () => {
      try {
        // For local midnight strategy, recalculate target each tick
        // (ensures we stay accurate across midnight boundaries)
        const currentTarget =
          strategy === "localMidnight" && !targetTimestamp
            ? Date.now() + getMillisUntilLocalMidnight()
            : effectiveTarget;

        const result = calculateCountdownTime(
          {
            targetTimestamp: currentTarget,
            enableFallback: strategy === "serverMidnight" ? enableFallback : false,
          },
          Date.now(),
        );

        setTimeString(result.timeString);

        // Only surface errors for server strategy (local can't fail)
        if (strategy === "serverMidnight") {
          setError(result.error);
        } else {
          setError(null);
        }

        // Handle completion transition
        if (shouldTriggerCompletion(result, isComplete)) {
          setIsComplete(true);
          logger.warn("[useCountdown] Countdown complete, new puzzle should be available");
        } else if (didCountdownRestart(result, isComplete)) {
          setIsComplete(false);
        }
      } catch (err) {
        logger.error("[useCountdown] Calculation failed:", err);
        setTimeString("--:--:--");
        setError("Countdown calculation failed");
      }
    };

    // Update immediately
    updateCountdown();

    // Set up interval for real-time updates
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [effectiveTarget, isLoading, enableFallback, isComplete, strategy, targetTimestamp]);

  return {
    timeString,
    isComplete,
    isLoading,
    error,
  };
}
