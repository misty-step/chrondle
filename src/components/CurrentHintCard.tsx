"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { HintText } from "@/components/ui/HintText";
import { ANIMATION_DURATIONS } from "@/lib/animationConstants";

interface CurrentHintCardProps {
  event: string | null;
  hintNumber: number;
  totalHints: number;
  isLoading: boolean;
  error: string | null;
  isInitialHint?: boolean; // True for first hint on load, false for hints after guesses
}

export const CurrentHintCard: React.FC<CurrentHintCardProps> = React.memo(
  ({ event, hintNumber, totalHints, isLoading, error, isInitialHint = false }) => {
    const shouldReduceMotion = useReducedMotion();

    // State for incorrect guess feedback animation
    const [showFeedback, setShowFeedback] = useState(false);
    const prevHintNumber = useRef(hintNumber);

    // Trigger feedback pulse when hint number changes (indicates incorrect guess)
    useEffect(() => {
      // If hint number increased and this isn't the initial mount
      if (hintNumber > prevHintNumber.current && prevHintNumber.current > 0) {
        setShowFeedback(true);
        const timeout = setTimeout(() => {
          setShowFeedback(false);
        }, ANIMATION_DURATIONS.HINT_FEEDBACK);
        return () => clearTimeout(timeout);
      }
      prevHintNumber.current = hintNumber;
    }, [hintNumber]);

    // Determine entrance delay based on context
    // - Initial hint (first load): 600ms delay for dramatic reveal
    // - Subsequent hints (after demotion): 1400ms delay for coordination
    const entranceDelay = isInitialHint
      ? ANIMATION_DURATIONS.HINT_DELAY / 1000
      : ANIMATION_DURATIONS.NEW_HINT_DELAY / 1000;

    // Don't render if we have an error
    if (error) {
      return null;
    }

    const hintText = event || "[DATA MISSING]";

    return (
      <motion.div
        key={hintNumber}
        initial={shouldReduceMotion ? undefined : { opacity: 0 }}
        animate={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                borderColor: showFeedback ? "rgb(239, 68, 68)" : undefined,
              }
        }
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: -20 }}
        transition={{
          duration: ANIMATION_DURATIONS.HINT_TRANSITION / 1000,
          delay: shouldReduceMotion ? 0 : entranceDelay,
          borderColor: {
            duration: ANIMATION_DURATIONS.HINT_FEEDBACK / 1000,
            ease: "easeInOut",
          },
        }}
        className="w-full"
      >
        <div className="material-card border-l-vermilion-500 bg-vermilion-50/30 dark:bg-vermilion-950/20 border-l-4 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="bg-vermilion-500 rounded-sm px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
              Current Clue
            </span>
            <span
              className="text-muted-foreground font-accent text-xs tracking-wide"
              aria-label={`Hint ${hintNumber} of ${totalHints}. ${totalHints - hintNumber + 1} guesses remaining`}
            >
              {hintNumber} of {totalHints}
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3">
              <LoadingSpinner size="sm" />
              <span className="font-body text-muted-foreground text-base">Loading hint...</span>
            </div>
          ) : (
            <div role="status" aria-live="polite" aria-atomic="true">
              <HintText className="font-body text-foreground text-left text-base leading-relaxed sm:text-lg">
                {hintText}
              </HintText>
            </div>
          )}
        </div>
      </motion.div>
    );
  },
);

CurrentHintCard.displayName = "CurrentHintCard";
