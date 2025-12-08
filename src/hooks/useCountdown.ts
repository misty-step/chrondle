"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  calculateCountdownTime,
  shouldTriggerCompletion,
  didCountdownRestart,
} from "@/lib/time/countdownCalculation";
import { logger } from "@/lib/logger";

export interface UseCountdownReturn {
  timeString: string;
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseCountdownOptions {
  /**
   * Target timestamp (Unix milliseconds) to countdown to.
   * If not provided, uses Convex getCronSchedule query.
   */
  targetTimestamp?: number;

  /**
   * Whether to use fallback local midnight calculation
   * when Convex query fails. Defaults to true.
   */
  enableFallback?: boolean;
}

export function useCountdown(options: UseCountdownOptions = {}): UseCountdownReturn {
  const { targetTimestamp, enableFallback = true } = options;

  const [timeString, setTimeString] = useState("00:00:00");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get cron schedule from Convex if no target timestamp provided
  const cronSchedule = useQuery(api.puzzles.getCronSchedule, targetTimestamp ? undefined : {});

  // Calculate effective target timestamp
  const effectiveTarget = targetTimestamp || cronSchedule?.nextScheduledTime;
  const isLoading = !targetTimestamp && cronSchedule === undefined;

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
        const result = calculateCountdownTime(
          { targetTimestamp: effectiveTarget, enableFallback },
          Date.now(),
        );

        setTimeString(result.timeString);
        setError(result.error);

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
  }, [effectiveTarget, isLoading, enableFallback, isComplete]);

  return {
    timeString,
    isComplete,
    isLoading,
    error,
  };
}
