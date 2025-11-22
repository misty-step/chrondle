"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { ANIMATION_DURATIONS, ANIMATION_SPRINGS, msToSeconds } from "@/lib/animationConstants";
import { formatYear } from "@/lib/displayFormatting";
import type { OrderEvent } from "@/types/orderGameState";

interface ComparisonGridProps {
  events: OrderEvent[];
  finalOrder: string[]; // Player's submission
  correctOrder: string[]; // Chronological truth
}

export function ComparisonGrid({ events, finalOrder, correctOrder }: ComparisonGridProps) {
  const prefersReducedMotion = useReducedMotion();
  const eventMap = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const listVariants = prefersReducedMotion
    ? undefined
    : {
        hidden: {},
        reveal: {
          transition: {
            staggerChildren: 0.08,
            delayChildren: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
          },
        },
      };

  const itemVariants = prefersReducedMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 12 },
        reveal: {
          opacity: 1,
          y: 0,
          transition: {
            type: "spring" as const,
            ...ANIMATION_SPRINGS.SMOOTH,
          },
        },
      };

  return (
    <div className="space-y-6">
      {/* Mobile: Stacked Sections with Clear Separation */}
      <div className="space-y-6 md:hidden">
        {/* Your Ordering Section */}
        <motion.div
          className="bg-muted/30 border-border shadow-warm space-y-3 rounded-xl border-2 p-4"
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "reveal"}
          variants={listVariants}
        >
          <h3 className="text-foreground text-center font-sans text-sm font-bold tracking-wide uppercase">
            Your Ordering
          </h3>
          <ol className="space-y-2">
            {finalOrder.map((eventId, index) => {
              const event = eventMap.get(eventId);
              if (!event) return null;

              const correctIndex = correctOrder.indexOf(eventId);
              const isCorrect = correctIndex === index;

              return (
                <motion.li
                  key={`player-${eventId}`}
                  variants={itemVariants}
                  className={[
                    "border-border shadow-warm rounded-lg border p-3",
                    isCorrect
                      ? "bg-feedback-success/10 border-feedback-success/30"
                      : "bg-destructive/10 border-destructive/30",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground font-year mb-1 text-xs font-medium">
                        #{index + 1}
                      </div>
                      <div className="text-primary font-event mb-1 text-sm leading-snug">
                        {event.text}
                      </div>
                      <div className="text-muted-foreground font-year text-xs">
                        {formatYear(event.year)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isCorrect ? (
                        <Check className="text-feedback-success h-5 w-5" aria-label="Correct" />
                      ) : (
                        <X className="text-destructive h-5 w-5" aria-label="Incorrect" />
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </motion.div>

        {/* VS Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-border absolute inset-0 flex items-center">
            <div className="border-border w-full border-t-2"></div>
          </div>
          <div className="bg-background text-muted-foreground relative px-4 text-sm font-bold tracking-wider uppercase">
            VS
          </div>
        </div>

        {/* Correct Timeline Section */}
        <motion.div
          className="bg-feedback-success/5 border-feedback-success/20 shadow-warm space-y-3 rounded-xl border-2 p-4"
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "reveal"}
          variants={listVariants}
        >
          <h3 className="text-foreground text-center font-sans text-sm font-bold tracking-wide uppercase">
            Correct Timeline
          </h3>
          <ol className="space-y-2">
            {correctOrder.map((eventId, index) => {
              const event = eventMap.get(eventId);
              if (!event) return null;

              return (
                <motion.li
                  key={`correct-${eventId}`}
                  variants={itemVariants}
                  className="bg-background border-border shadow-warm rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground font-year mb-1 text-xs font-medium">
                        #{index + 1}
                      </div>
                      <div className="text-primary font-event mb-1 text-sm leading-snug">
                        {event.text}
                      </div>
                      <div className="text-muted-foreground font-year text-xs">
                        {formatYear(event.year)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Check
                        className="text-muted-foreground h-5 w-5"
                        aria-label="Chronological position"
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </motion.div>
      </div>

      {/* Desktop: Side-by-Side Comparison */}
      <div className="hidden md:block">
        {/* Headers */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="text-muted-foreground text-center text-sm font-semibold tracking-wide uppercase">
            Your Ordering
          </div>
          <div className="text-muted-foreground text-center text-sm font-semibold tracking-wide uppercase">
            Correct Timeline
          </div>
        </div>

        {/* Comparison Grid */}
        <motion.div
          className="grid grid-cols-2 gap-4"
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "reveal"}
          variants={listVariants}
        >
          {/* Player's Order Column */}
          <ol className="space-y-2">
            {finalOrder.map((eventId, index) => {
              const event = eventMap.get(eventId);
              if (!event) return null;

              const correctIndex = correctOrder.indexOf(eventId);
              const isCorrect = correctIndex === index;

              return (
                <motion.li
                  key={`player-${eventId}`}
                  variants={itemVariants}
                  className={[
                    "border-border shadow-warm rounded-lg border p-3",
                    isCorrect
                      ? "bg-feedback-success/10 border-feedback-success/30"
                      : "bg-destructive/10 border-destructive/30",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground font-year mb-1 text-xs font-medium">
                        #{index + 1}
                      </div>
                      <div className="text-primary font-event mb-1 text-sm leading-snug">
                        {event.text}
                      </div>
                      <div className="text-muted-foreground font-year text-xs">
                        {formatYear(event.year)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isCorrect ? (
                        <Check className="text-feedback-success h-5 w-5" aria-label="Correct" />
                      ) : (
                        <X className="text-destructive h-5 w-5" aria-label="Incorrect" />
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>

          {/* Correct Order Column */}
          <ol className="space-y-2">
            {correctOrder.map((eventId, index) => {
              const event = eventMap.get(eventId);
              if (!event) return null;

              return (
                <motion.li
                  key={`correct-${eventId}`}
                  variants={itemVariants}
                  className="bg-background border-border shadow-warm rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground font-year mb-1 text-xs font-medium">
                        #{index + 1}
                      </div>
                      <div className="text-primary font-event mb-1 text-sm leading-snug">
                        {event.text}
                      </div>
                      <div className="text-muted-foreground font-year text-xs">
                        {formatYear(event.year)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Check
                        className="text-muted-foreground h-5 w-5"
                        aria-label="Chronological position"
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </motion.div>
      </div>
    </div>
  );
}
