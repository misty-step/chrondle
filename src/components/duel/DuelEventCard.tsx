"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { formatYear } from "@/lib/displayFormatting";
import { useReducedMotion } from "@/lib/animationConstants";
import type { DuelRoundEventView } from "@/lib/duel/runReducer";

interface DuelEventCardProps {
  event: DuelRoundEventView;
  revealed: boolean;
  /** Player tapped this card */
  picked: boolean;
  /** This card holds the earlier event (only meaningful when revealed) */
  isEarlier: boolean;
  disabled: boolean;
  onChoose: () => void;
}

/**
 * One of the two tap targets in a Duel round.
 *
 * Pre-reveal: a neutral card with only the event text — no tells.
 * Post-reveal: the year stamps in; the earlier event reads as the answer,
 * a wrong pick reads as the mistake.
 */
export function DuelEventCard({
  event,
  revealed,
  picked,
  isEarlier,
  disabled,
  onChoose,
}: DuelEventCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const outcome: "correct" | "wrong" | "neutral" = !revealed
    ? "neutral"
    : isEarlier
      ? "correct"
      : picked
        ? "wrong"
        : "neutral";

  return (
    <motion.button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      whileTap={!disabled && !prefersReducedMotion ? { scale: 0.985 } : undefined}
      className={cn(
        "paper-edge relative w-full rounded border-2 p-5 text-left transition-colors sm:p-6",
        "min-h-28 sm:min-h-32",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        outcome === "neutral" && "border-border bg-surface-elevated",
        !revealed && !disabled && "hover:border-mode-duel-accent/60 cursor-pointer",
        outcome === "correct" && "border-feedback-success bg-feedback-success/10",
        outcome === "wrong" && "border-feedback-error bg-feedback-error/10",
        revealed && outcome === "neutral" && "opacity-80",
      )}
      aria-label={revealed ? `${event.text} — ${formatYear(event.year)}` : event.text}
    >
      <span className="text-body-primary font-body block pr-2 text-base leading-snug font-medium text-pretty sm:text-lg">
        {event.text}
      </span>

      <span className="mt-3 flex min-h-7 items-center justify-between gap-2">
        <AnimatePresence>
          {revealed && (
            <motion.span
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-sm font-bold tabular-nums",
                outcome === "correct" &&
                  "border-feedback-success/40 text-feedback-success bg-white/50 dark:bg-black/20",
                outcome === "wrong" &&
                  "border-feedback-error/40 text-feedback-error bg-white/50 dark:bg-black/20",
                outcome === "neutral" && "border-border text-body-secondary",
              )}
            >
              {formatYear(event.year)}
            </motion.span>
          )}
        </AnimatePresence>

        {revealed && isEarlier && (
          <span className="text-feedback-success text-xs font-bold tracking-wider uppercase">
            First
          </span>
        )}
        {revealed && picked && !isEarlier && (
          <span className="text-feedback-error text-xs font-bold tracking-wider uppercase">
            Your pick
          </span>
        )}
      </span>
    </motion.button>
  );
}
