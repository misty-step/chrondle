"use client";

import { motion, useReducedMotion } from "motion/react";
import { ANIMATION_DURATIONS, ANIMATION_SPRINGS, msToSeconds } from "@/lib/animationConstants";
import { getPerformanceTier, getTierColorClass } from "@/lib/order/performanceTier";

interface PerformanceTierProps {
  accuracyPercent: number;
}

export function PerformanceTier({ accuracyPercent }: PerformanceTierProps) {
  const prefersReducedMotion = useReducedMotion();
  const tier = getPerformanceTier(accuracyPercent);
  const colorClass = getTierColorClass(tier.tier);

  return (
    <motion.div
      className="space-y-3 text-center"
      initial={prefersReducedMotion ? false : { opacity: 0, y: -20, scale: 0.95 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        ...ANIMATION_SPRINGS.SMOOTH,
      }}
    >
      {/* Title */}
      <motion.h2
        className={`text-4xl font-bold sm:text-5xl ${colorClass}`}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? undefined
            : {
                type: "spring",
                ...ANIMATION_SPRINGS.SMOOTH,
                delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
              }
        }
      >
        {tier.title}
      </motion.h2>

      {/* Message */}
      <motion.p
        className="text-muted-foreground text-base"
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
                delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY) * 1.5,
              }
        }
      >
        {tier.message}
      </motion.p>
    </motion.div>
  );
}
