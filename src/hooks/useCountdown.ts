"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatCountdown, getTimeUntilMidnight } from "@/lib/displayFormatting";
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
      // New target arrived, reset completion
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
        let remaining: number;

        if (effectiveTarget) {
          // Use Convex-provided timestamp
          const now = Date.now();
          remaining = effectiveTarget - now;
          setError(null);
        } else if (enableFallback) {
          // Fallback to local midnight calculation
          remaining = getTimeUntilMidnight();
          if (!error) {
            setError("Using local countdown - server timing unavailable");
          }
        } else {
          // No fallback, show error state
          setTimeString("--:--:--");
          setIsComplete(false);
          setError("Countdown unavailable");
          return;
        }

        if (remaining <= 0) {
          setTimeString("00:00:00");
          if (!isComplete) {
            setIsComplete(true);
            logger.warn("[useCountdown] Countdown complete, new puzzle should be available");
            // The query will refetch automatically due to Convex reactivity
          }
          return;
        }

        setTimeString(formatCountdown(remaining));
        if (isComplete) {
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
  }, [effectiveTarget, isLoading, enableFallback, error, isComplete]);

  return {
    timeString,
    isComplete,
    isLoading,
    error,
  };
}
