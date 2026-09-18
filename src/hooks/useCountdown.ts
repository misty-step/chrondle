"use client";

import { useState, useEffect } from "react";
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

export interface UseCountdownOptions {
  /**
   * Target timestamp (Unix milliseconds) to countdown to.
   * If provided, overrides the local-midnight default.
   * Supported for archive/testing scenarios.
   */
  targetTimestamp?: number;
}

/**
 * Countdown to the next daily puzzle.
 *
 * Day semantics: the next puzzle unlocks at the PLAYER'S local midnight —
 * Chrondle's canonical "today" is the player's local calendar day (see
 * src/lib/time/dailyDate.ts), and this hook derives its target from that
 * module's getMillisUntilLocalMidnight. There is deliberately no server-clock
 * strategy: a server-derived rollover would disagree with the puzzle the
 * player is shown.
 */
export function useCountdown(options: UseCountdownOptions = {}): UseCountdownReturn {
  const { targetTimestamp } = options;

  const [timeString, setTimeString] = useState("00:00:00");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      try {
        // For the local-midnight default, recalculate the target each tick
        // (ensures we stay accurate across midnight boundaries)
        const currentTarget = targetTimestamp ?? Date.now() + getMillisUntilLocalMidnight();

        const result = calculateCountdownTime(
          {
            targetTimestamp: currentTarget,
            enableFallback: false,
          },
          Date.now(),
        );

        setTimeString(result.timeString);
        setError(null);

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
  }, [isComplete, targetTimestamp]);

  return {
    timeString,
    isComplete,
    // Local midnight is computed client-side; there is nothing to load.
    isLoading: false,
    error,
  };
}
