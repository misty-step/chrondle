"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Share2 } from "lucide-react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
import type { AttemptScore } from "@/types/orderGameState";

interface OrderRevealProps {
  score: AttemptScore;
  puzzleNumber: number;
  onShare?: () => void;
}

/**
 * Archival-style success messaging based on arrangement count.
 */
function getArchivalDisplay(attempts: number): {
  title: string;
  message: string;
} {
  if (attempts === 1) {
    return {
      title: "Perfectly Catalogued",
      message: "First attempt, correct order",
    };
  }
  if (attempts === 2) {
    return {
      title: "Expertly Curated",
      message: "Timeline established with precision",
    };
  }
  if (attempts <= 4) {
    return {
      title: "Successfully Archived",
      message: "Chronology confirmed",
    };
  }
  return {
    title: "Timeline Complete",
    message: "Events placed in historical order",
  };
}

export function OrderReveal({ score, puzzleNumber, onShare }: OrderRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isShared, setIsShared] = useState(false);

  const archivalDisplay = useMemo(() => getArchivalDisplay(score.attempts), [score.attempts]);
  const attemptLabel = score.attempts === 1 ? "attempt" : "attempts";

  const handleShareClick = async () => {
    if (isShared || !onShare) return;

    await onShare();
    setIsShared(true);

    setTimeout(() => {
      setIsShared(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <motion.div
        className="border-feedback-success/30 bg-feedback-success/5 shadow-hard flex w-full items-center gap-4 rounded-sm border-2 p-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
        }}
      >
        {/* Left side: Success message */}
        <div className="flex flex-1 flex-col items-start">
          <div className="text-feedback-success mb-1 text-xs font-medium tracking-wide uppercase">
            Puzzle №{puzzleNumber} · {score.attempts} {attemptLabel}
          </div>
          <div className="text-feedback-success text-2xl font-bold sm:text-3xl">
            {archivalDisplay.title}
          </div>
          <div className="text-feedback-success/80 mt-1 text-sm">{archivalDisplay.message}</div>
        </div>

        {/* Right side: Check icon */}
        <div className="border-feedback-success/30 bg-feedback-success/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-sm border-2">
          <Check className="text-feedback-success h-6 w-6" aria-hidden="true" />
        </div>
      </motion.div>

      {/* Share Card */}
      <motion.div
        className="border-primary/20 from-primary/5 to-primary/10 shadow-hard flex w-full flex-col gap-6 rounded-sm border-2 bg-gradient-to-br p-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
          delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
        }}
      >
        {/* Score summary */}
        <div className="text-foreground">
          <div className="text-muted-foreground text-sm">
            Completed in{" "}
            <span className="font-year font-semibold">
              {score.attempts} {attemptLabel}
            </span>
          </div>
        </div>

        {/* Share button */}
        {onShare && (
          <div className="flex justify-start">
            <motion.button
              type="button"
              onClick={handleShareClick}
              disabled={isShared}
              className="bg-primary text-primary-foreground shadow-hard-lg hover:bg-primary/90 flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm px-8 py-3 text-base font-semibold transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto"
              whileTap={
                prefersReducedMotion || isShared
                  ? undefined
                  : {
                      scale: 0.95,
                    }
              }
            >
              {isShared ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-5 w-5" />
                  <span>Share Result</span>
                </>
              )}
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
