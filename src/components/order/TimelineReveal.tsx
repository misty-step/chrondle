"use client";

import { motion, useReducedMotion } from "motion/react";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
import type { OrderEvent } from "@/types/orderGameState";

interface TimelineRevealProps {
  /** Events already sorted in chronological order */
  events: OrderEvent[];
}

/**
 * Displays the correct chronological order of events with their years revealed.
 * Shows after a successful Order mode completion as the "answer reveal" moment.
 */
export function TimelineReveal({ events }: TimelineRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  if (events.length === 0) return null;

  return (
    <motion.div
      className="border-border/40 bg-surface-elevated rounded border shadow-inner"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
      }}
    >
      {/* Header */}
      <div className="border-border/40 border-b px-4 py-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          The Correct Order
        </h3>
      </div>

      {/* Timeline */}
      <div className="divide-border/30 divide-y">
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            className="flex items-start gap-4 px-4 py-3"
            initial={prefersReducedMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
              delay: prefersReducedMotion
                ? 0
                : msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY) + index * 0.08,
            }}
          >
            {/* Year - Hero Typography */}
            <div className="flex w-20 flex-shrink-0 flex-col items-end">
              <span
                className="text-body-primary font-year text-xl leading-tight font-bold tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.abs(event.year)}
              </span>
              <span className="text-muted-foreground text-xs font-medium">
                {event.year < 0 ? "BC" : "AD"}
              </span>
            </div>

            {/* Connecting element */}
            <div className="bg-primary/30 mt-2 h-px w-3 flex-shrink-0" />

            {/* Event text */}
            <p className="text-body-secondary flex-1 text-sm leading-snug">{event.text}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
