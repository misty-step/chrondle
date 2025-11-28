"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
import { getAccuracyPercent, getCorrectPositionCount } from "@/lib/order/golfScoring";
import type { OrderAttempt } from "@/types/orderGameState";

interface AttemptFeedbackProps {
  attempt: OrderAttempt;
  attemptNumber: number;
}

/**
 * Displays feedback from a single attempt.
 * Shows per-position correctness and pair accuracy.
 */
export function AttemptFeedback({ attempt, attemptNumber }: AttemptFeedbackProps) {
  const prefersReducedMotion = useReducedMotion();

  const correctCount = getCorrectPositionCount(attempt);
  const totalCount = attempt.feedback.length;
  const accuracyPercent = getAccuracyPercent(attempt);

  const isPerfect = correctCount === totalCount;

  return (
    <motion.div
      className="border-border bg-surface-elevated shadow-hard rounded-sm border-2 p-4"
      initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION) }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">Attempt {attemptNumber}</span>
        <span className="text-foreground text-sm font-semibold">
          {correctCount}/{totalCount} correct
        </span>
      </div>

      {/* Position indicators */}
      <div className="mb-3 flex justify-center gap-2">
        {attempt.feedback.map((feedback, idx) => (
          <motion.div
            key={idx}
            className={`flex h-10 w-10 items-center justify-center rounded-sm border-2 ${
              feedback === "correct"
                ? "border-green-500/30 bg-green-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
            initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
              delay: idx * 0.05,
            }}
          >
            {feedback === "correct" ? (
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <X className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </motion.div>
        ))}
      </div>

      {/* Pairs accuracy */}
      <div className="text-muted-foreground text-center text-sm">
        {isPerfect ? (
          <span className="font-semibold text-green-600 dark:text-green-400">Perfect order!</span>
        ) : (
          <span>
            {attempt.pairsCorrect}/{attempt.totalPairs} pairs correct ({accuracyPercent}%)
          </span>
        )}
      </div>
    </motion.div>
  );
}

interface AttemptHistoryProps {
  attempts: OrderAttempt[];
  par: number;
}

/**
 * Shows the history of all attempts with a summary header.
 */
export function AttemptHistory({ attempts, par }: AttemptHistoryProps) {
  const prefersReducedMotion = useReducedMotion();

  if (attempts.length === 0) {
    return null;
  }

  const lastAttempt = attempts[attempts.length - 1];
  const strokesLabel = attempts.length === 1 ? "stroke" : "strokes";

  return (
    <motion.div
      className="space-y-3"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="text-foreground text-sm font-medium">
          {attempts.length} {strokesLabel} · Par {par}
        </div>
        <ProgressDots attempts={attempts} />
      </div>

      {/* Last attempt feedback */}
      <AttemptFeedback attempt={lastAttempt} attemptNumber={attempts.length} />
    </motion.div>
  );
}

interface ProgressDotsProps {
  attempts: OrderAttempt[];
}

/**
 * Compact visual representation of attempt history.
 */
function ProgressDots({ attempts }: ProgressDotsProps) {
  return (
    <div className="flex gap-1">
      {attempts.map((attempt, idx) => {
        const correctCount = getCorrectPositionCount(attempt);
        const total = attempt.feedback.length;
        const ratio = correctCount / total;

        // Color based on how close to perfect
        let colorClass: string;
        if (ratio === 1) {
          colorClass = "bg-green-500";
        } else if (ratio >= 0.5) {
          colorClass = "bg-amber-500";
        } else {
          colorClass = "bg-red-500";
        }

        return (
          <div
            key={idx}
            className={`h-2 w-2 rounded-full ${colorClass}`}
            title={`Attempt ${idx + 1}: ${correctCount}/${total}`}
          />
        );
      })}
    </div>
  );
}
