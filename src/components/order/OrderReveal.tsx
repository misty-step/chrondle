"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Share2 } from "lucide-react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
import { getGolfTerm, getGolfEmoji, type GolfScore, type OrderEvent } from "@/types/orderGameState";
import { ComparisonGrid } from "./ComparisonGrid";

interface OrderRevealProps {
  events: OrderEvent[];
  finalOrder: string[];
  correctOrder: string[];
  score: GolfScore;
  puzzleNumber: number;
  onShare?: () => void;
}

/**
 * Golf-style terminology display.
 */
function getScoreDisplay(score: GolfScore): {
  title: string;
  message: string;
  emoji: string;
} {
  const term = getGolfTerm(score.relativeToPar);
  const emoji = getGolfEmoji(term);

  switch (term) {
    case "hole-in-one":
      return {
        title: "Hole in One!",
        message: "Perfect chronological intuition!",
        emoji,
      };
    case "eagle":
      return {
        title: "Eagle!",
        message: "Exceptional historical knowledge!",
        emoji,
      };
    case "birdie":
      return {
        title: "Birdie!",
        message: "Great chronological sense!",
        emoji,
      };
    case "par":
      return {
        title: "Par",
        message: "Solid timeline ordering!",
        emoji,
      };
    case "bogey":
      return {
        title: "Bogey",
        message: "Close to par - nice work!",
        emoji,
      };
    case "double-bogey":
      return {
        title: "Double Bogey",
        message: "A challenging puzzle!",
        emoji,
      };
    case "triple-bogey":
      return {
        title: "Triple Bogey",
        message: "This one was tricky!",
        emoji,
      };
    case "over-par":
      return {
        title: `+${score.relativeToPar}`,
        message: "A real challenge - but you solved it!",
        emoji,
      };
  }
}

/**
 * Get gradient classes for golf score tier.
 */
function getScoreGradientClasses(relativeToPar: number) {
  if (relativeToPar <= -2) {
    // Eagle or better - gold/yellow
    return {
      background: "bg-gradient-to-br from-yellow-500/5 to-amber-600/10",
      border: "border-yellow-500/20",
      textColor: "text-yellow-700 dark:text-yellow-300",
      labelColor: "text-yellow-600 dark:text-yellow-400",
    };
  }
  if (relativeToPar <= 0) {
    // Birdie or par - green
    return {
      background: "bg-gradient-to-br from-green-500/5 to-green-600/10",
      border: "border-green-500/20",
      textColor: "text-green-700 dark:text-green-300",
      labelColor: "text-green-600 dark:text-green-400",
    };
  }
  if (relativeToPar <= 2) {
    // Bogey/double bogey - blue
    return {
      background: "bg-gradient-to-br from-blue-500/5 to-blue-600/10",
      border: "border-blue-500/20",
      textColor: "text-blue-700 dark:text-blue-300",
      labelColor: "text-blue-600 dark:text-blue-400",
    };
  }
  // Over par - red
  return {
    background: "bg-gradient-to-br from-red-500/5 to-red-600/10",
    border: "border-red-500/20",
    textColor: "text-red-700 dark:text-red-300",
    labelColor: "text-red-600 dark:text-red-400",
  };
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

  const scoreDisplay = useMemo(() => getScoreDisplay(score), [score]);
  const tierStyles = getScoreGradientClasses(score.relativeToPar);

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
      {/* Performance Banner Card */}
      <motion.div
        className={`flex w-full items-center gap-4 rounded-sm border-2 ${tierStyles.border} ${tierStyles.background} shadow-hard p-6`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{
          duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
        }}
      >
        {/* Left side: Score message */}
        <div className="flex flex-1 flex-col items-start">
          <div
            className={`mb-1 text-xs font-medium tracking-wide uppercase ${tierStyles.labelColor}`}
          >
            {score.strokes} {score.strokes === 1 ? "Stroke" : "Strokes"} · Par {score.par}
          </div>
          <div
            className={`flex items-center gap-2 text-2xl font-bold sm:text-3xl ${tierStyles.textColor}`}
          >
            <span>{scoreDisplay.emoji}</span>
            <span>{scoreDisplay.title}</span>
          </div>
          <div className={`mt-1 text-sm ${tierStyles.labelColor}/80`}>{scoreDisplay.message}</div>
        </div>

        {/* Right side: Puzzle number */}
        <div className={`text-sm font-medium ${tierStyles.labelColor}`}>#{puzzleNumber}</div>
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
        {/* Score breakdown */}
        <div className="text-foreground">
          <div className="text-muted-foreground text-sm">
            Solved in <span className="font-semibold">{score.strokes}</span>{" "}
            {score.strokes === 1 ? "attempt" : "attempts"}
          </div>
        </div>

        {/* Share button */}
        {onShare && (
          <div className="flex justify-start">
            <motion.button
              type="button"
              onClick={handleShareClick}
              disabled={isShared}
              className="bg-primary text-body-primary-foreground hover:bg-primary/90 shadow-hard-lg flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm px-8 py-3 text-base font-semibold transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto"
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
