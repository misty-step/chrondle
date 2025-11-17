"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { ANIMATION_DURATIONS, ANIMATION_SPRINGS, msToSeconds } from "@/lib/animationConstants";
import { PerformanceTier } from "./PerformanceTier";
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
    <motion.section
      className="border-border bg-card shadow-warm-lg relative overflow-hidden rounded-xl border p-6 sm:p-8"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: ANIMATION_DURATIONS.HINT_TRANSITION / 1000,
      }}
    >
      {/* Decorative Corner Ornaments */}
      <div
        className="absolute top-0 left-0 h-16 w-16 border-t-2 border-l-2 opacity-20"
        style={{ borderColor: "var(--timeline-spine)" }}
      />
      <div
        className="absolute top-0 right-0 h-16 w-16 border-t-2 border-r-2 opacity-20"
        style={{ borderColor: "var(--timeline-spine)" }}
      />
      <div
        className="absolute bottom-0 left-0 h-16 w-16 border-b-2 border-l-2 opacity-20"
        style={{ borderColor: "var(--timeline-spine)" }}
      />
      <div
        className="absolute right-0 bottom-0 h-16 w-16 border-r-2 border-b-2 opacity-20"
        style={{ borderColor: "var(--timeline-spine)" }}
      />

      {/* Header */}
      <motion.div
        className="space-y-2 text-center"
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
              }
        }
      >
        <p className="text-muted-foreground font-sans text-[10px] font-semibold tracking-widest uppercase">
          Chronological Sorting Exercise
        </p>
        <p className="text-foreground font-serif text-base font-medium">
          Certificate of Completion
        </p>
        <p className="text-muted-foreground text-sm">Order #{puzzleNumber}</p>
      </motion.div>

      {/* Ornamental Divider */}
      <div className="my-6 flex items-center justify-center gap-2">
        <div className="via-timeline-spine/30 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
        <span className="text-timeline-marker text-xl">⚜</span>
        <div className="via-timeline-spine/30 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
      </div>

      {/* Emotional Headline */}
      <PerformanceTier accuracyPercent={accuracyPercent} />

      {/* Score Breakdown */}
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? undefined
            : {
                type: "spring",
                ...ANIMATION_SPRINGS.GENTLE,
                delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
              }
        }
      >
        <ScoreTooltip score={score} />
      </motion.div>

      {/* Ornamental Divider */}
      <div className="my-6 flex items-center justify-center gap-2">
        <div className="via-timeline-spine/20 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
      </div>

      {/* Share Button */}
      {onShare && (
        <motion.div
          className="flex justify-center"
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  type: "spring",
                  ...ANIMATION_SPRINGS.SMOOTH,
                  delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY) * 1.5,
                }
          }
        >
          <motion.button
            type="button"
            onClick={handleShareClick}
            disabled={isShared}
            className="flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold shadow-lg transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-80"
            style={{
              backgroundColor: "var(--locked-badge)",
              color: "white",
            }}
            whileTap={
              prefersReducedMotion || isShared
                ? undefined
                : {
                    scale: 0.95,
                  }
            }
            animate={
              prefersReducedMotion || !isShared
                ? undefined
                : {
                    scale: [1, 1.05, 1],
                  }
            }
            transition={
              prefersReducedMotion || !isShared
                ? undefined
                : {
                    duration: 0.3,
                    ease: "easeOut",
                  }
            }
          >
            {isShared && <Check className="h-5 w-5" />}
            {isShared ? "Copied!" : "Share Result"}
          </motion.button>
        </motion.div>
      )}

      {/* Ornamental Divider */}
      <div className="my-8 flex items-center justify-center gap-2">
        <div className="via-timeline-spine/20 h-px flex-1 bg-gradient-to-r from-transparent to-transparent" />
      </div>

      {/* Comparison Grid */}
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
                delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY) * 2,
              }
        }
      >
        <ComparisonGrid events={events} finalOrder={finalOrder} correctOrder={correctOrder} />
      </motion.div>
    </motion.section>
  );
}
