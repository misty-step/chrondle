"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
import { getAccuracyPercent, getCorrectPositionCount } from "@/lib/order/attemptScoring";
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
      className="border-border bg-surface-elevated rounded border-2 p-4"
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
            className={`flex h-10 w-10 items-center justify-center rounded border-2 ${
              feedback === "correct"
                ? "border-feedback-success/30 bg-feedback-success/10"
                : "border-destructive/30 bg-destructive/10"
            }`}
            initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
              delay: idx * 0.05,
            }}
          >
            {feedback === "correct" ? (
              <Check className="text-feedback-success h-5 w-5" />
            ) : (
              <X className="text-destructive h-5 w-5" />
            )}
          </motion.div>
        ))}
      </div>

      {/* Pairs accuracy */}
      <div className="text-muted-foreground text-center text-sm">
        {isPerfect ? (
          <span className="text-feedback-success font-semibold">Perfect order!</span>
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
}

/**
 * Shows the feedback from the last attempt.
 */
export function AttemptHistory({ attempts }: AttemptHistoryProps) {
  if (attempts.length === 0) {
    return null;
  }

  const lastAttempt = attempts[attempts.length - 1];

  return <AttemptFeedback attempt={lastAttempt} attemptNumber={attempts.length} />;
}
