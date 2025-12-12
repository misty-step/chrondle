"use client";

import { motion, useReducedMotion } from "motion/react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";

interface NextPuzzleCountdownCardProps {
  timeString: string;
}

/**
 * Shared "Next puzzle in ..." countdown card
 *
 * Used by:
 * - GameInstructions (Classic mode) when !isArchive
 * - OrderReveal (Order mode) when !isArchive
 *
 * Design: Matches existing GameInstructions countdown styling
 */
export function NextPuzzleCountdownCard({ timeString }: NextPuzzleCountdownCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="from-primary/5 to-primary/10 border-primary/20 rounded-card flex w-full items-center gap-4 border bg-gradient-to-br p-6"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
        delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
      }}
    >
      <div className="flex flex-1 flex-col items-start">
        <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
          Next puzzle in
        </div>
        <div className="text-body-primary font-mono text-2xl font-bold sm:text-3xl">
          {timeString || "00:00:00"}
        </div>
      </div>
    </motion.div>
  );
}
