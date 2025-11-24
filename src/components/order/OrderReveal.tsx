"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Share2 } from "lucide-react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
import { getPerformanceTier } from "@/lib/order/performanceTier";
import { ScoreTooltip } from "./ScoreTooltip";
import { ComparisonGrid } from "./ComparisonGrid";
import type { OrderEvent, OrderScore } from "../../types/orderGameState";

interface OrderRevealProps {
  events: OrderEvent[];
  finalOrder: string[];
  correctOrder: string[];
  score: OrderScore;
  puzzleNumber: number;
  onShare?: () => void;
}

/**
 * Get gradient classes for performance tier banner (matches Classic mode pattern)
 */
function getTierGradientClasses(tier: "perfect" | "excellent" | "good" | "fair" | "challenging") {
  switch (tier) {
    case "perfect":
      return {
        background: "bg-gradient-to-br from-green-500/5 to-green-600/10",
        border: "border-green-500/20",
        textColor: "text-green-700 dark:text-green-300",
        labelColor: "text-green-600 dark:text-green-400",
      };
    case "excellent":
      return {
        background: "bg-gradient-to-br from-amber-500/5 to-amber-600/10",
        border: "border-amber-500/20",
        textColor: "text-amber-700 dark:text-amber-300",
        labelColor: "text-amber-600 dark:text-amber-400",
      };
    case "good":
      return {
        background: "bg-gradient-to-br from-blue-500/5 to-blue-600/10",
        border: "border-blue-500/20",
        textColor: "text-blue-700 dark:text-blue-300",
        labelColor: "text-blue-600 dark:text-blue-400",
      };
    case "fair":
    case "challenging":
      return {
        background: "bg-gradient-to-br from-red-500/5 to-red-600/10",
        border: "border-red-500/20",
        textColor: "text-red-700 dark:text-red-300",
        labelColor: "text-red-600 dark:text-red-400",
      };
  }
}

export function OrderReveal({
  events,
  finalOrder,
  correctOrder,
  score,
  puzzleNumber,
  onShare,
}: OrderRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isShared, setIsShared] = useState(false);

  const accuracyPercent = useMemo(
    () => Math.round((score.correctPairs / score.totalPairs) * 100),
    [score.correctPairs, score.totalPairs],
  );

  const performanceTier = useMemo(() => getPerformanceTier(accuracyPercent), [accuracyPercent]);
  const tierStyles = getTierGradientClasses(performanceTier.tier);

  const handleShareClick = async () => {
    if (isShared || !onShare) return;

    await onShare();
    setIsShared(true);

    // Reset after 2 seconds
    setTimeout(() => {
      setIsShared(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Performance Banner Card - Matches Classic win/loss banner pattern */}
      <motion.div
        className={`flex w-full items-center gap-4 rounded-sm border-2 ${tierStyles.border} ${tierStyles.background} shadow-hard p-6`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
        }}
      >
        {/* Left side: Performance message */}
        <div className="flex flex-1 flex-col items-start">
          <div
            className={`mb-1 text-xs font-medium tracking-wide uppercase ${tierStyles.labelColor}`}
          >
            Performance
          </div>
          <div className={`text-2xl font-bold sm:text-3xl ${tierStyles.textColor}`}>
            {performanceTier.title}
          </div>
          <div className={`mt-1 text-sm ${tierStyles.labelColor}/80`}>
            {performanceTier.message}
          </div>
        </div>

        {/* Right side: Puzzle number badge */}
        <div className={`text-sm font-medium ${tierStyles.labelColor}`}>#{puzzleNumber}</div>
      </motion.div>

      {/* Stats + Share Card - Matches Classic countdown/share card pattern */}
      <motion.div
        className="border-primary/20 from-primary/5 to-primary/10 shadow-hard flex w-full flex-col gap-6 rounded-sm border-2 bg-gradient-to-br p-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
          delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
        }}
      >
        {/* Stats - Full width on top */}
        <div>
          <ScoreTooltip score={score} />
        </div>

        {/* Share button - Left-aligned below stats */}
        {onShare && (
          <div className="flex justify-start">
            <motion.button
              type="button"
              onClick={handleShareClick}
              disabled={isShared}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-hard-lg flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm px-8 py-3 text-base font-semibold transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto"
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
                  <span>Share</span>
                </>
              )}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Event Comparison Card */}
      <motion.div
        className="border-border bg-surface-elevated shadow-hard rounded-sm border-2 p-6"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
          delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY) * 1.5,
        }}
      >
        <ComparisonGrid events={events} finalOrder={finalOrder} correctOrder={correctOrder} />
      </motion.div>
    </div>
  );
}
