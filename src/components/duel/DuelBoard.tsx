"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sword, Trophy } from "@phosphor-icons/react";

import { DuelEventCard } from "@/components/duel/DuelEventCard";
import { DuelRunSummary } from "@/components/duel/DuelRunSummary";
import { useReducedMotion } from "@/lib/animationConstants";
import { cn } from "@/lib/utils";
import type { UseDuelGameReturn } from "@/hooks/useDuelGame";

/** How long a correct reveal stays on screen before auto-advancing. */
const AUTO_ADVANCE_MS = 1300;
const AUTO_ADVANCE_REDUCED_MS = 900;

interface DuelBoardProps {
  game: UseDuelGameReturn;
}

/**
 * The Duel play surface: streak header, prompt, two tap targets, reveal
 * feedback, and the run summary once the player misses.
 *
 * Mobile-first by construction — the two cards stack vertically as large,
 * equal-weight thumb targets, and the whole reveal is tappable to skip the
 * auto-advance delay.
 */
export function DuelBoard({ game }: DuelBoardProps) {
  const prefersReducedMotion = useReducedMotion();
  const {
    status,
    round,
    streak,
    bestStreak,
    isNewBest,
    pick,
    wasCorrect,
    endReason,
    choose,
    advance,
    restart,
  } = game;

  const revealed = status === "revealed" || status === "over";
  const correctReveal = status === "revealed" && wasCorrect === true;

  // Auto-advance after a correct reveal; tapping anywhere skips the wait.
  useEffect(() => {
    if (!correctReveal) {
      return;
    }
    const timer = setTimeout(
      advance,
      prefersReducedMotion ? AUTO_ADVANCE_REDUCED_MS : AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [correctReveal, advance, prefersReducedMotion, round?.roundIndex]);

  const announcement = !revealed
    ? ""
    : !round
      ? ""
      : wasCorrect
        ? `Correct. ${describeReveal(round)}`
        : `Wrong. ${describeReveal(round)} Run over at ${streak}.`;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 sm:px-6">
      {/* Run header: round + tier on the left, streak on the right */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {round ? `Round ${round.roundIndex + 1}` : "Duel"}
          </p>
          {round && (
            <p className="text-mode-duel-accent text-sm font-bold tracking-wide uppercase">
              {round.tierLabel}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {bestStreak > 0 && (
            <div className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
              <Trophy className="size-4" aria-hidden="true" />
              <span className="tabular-nums">{bestStreak}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Sword className="text-mode-duel-accent size-5" aria-hidden="true" />
            <motion.span
              key={streak}
              initial={prefersReducedMotion || streak === 0 ? false : { scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="text-body-primary font-display text-3xl font-bold tabular-nums"
              aria-label={`Current streak: ${streak}`}
            >
              {streak}
            </motion.span>
          </div>
        </div>
      </div>

      {/* Prompt */}
      {status !== "over" && (
        <h2 className="text-foreground font-display text-2xl sm:text-3xl">Which happened first?</h2>
      )}

      {/* The two contenders */}
      {status === "loading" || !round ? (
        <div className="space-y-3" aria-label="Loading round" role="status">
          <div className="bg-surface-elevated border-border min-h-28 animate-pulse rounded border-2 sm:min-h-32" />
          <div className="bg-surface-elevated border-border min-h-28 animate-pulse rounded border-2 sm:min-h-32" />
        </div>
      ) : (
        <div className="space-y-3">
          <DuelEventCard
            event={round.first}
            revealed={revealed}
            picked={pick === "first"}
            isEarlier={round.first.year < round.second.year}
            disabled={status !== "choosing"}
            onChoose={() => choose("first")}
          />
          <DuelEventCard
            event={round.second}
            revealed={revealed}
            picked={pick === "second"}
            isEarlier={round.second.year < round.first.year}
            disabled={status !== "choosing"}
            onChoose={() => choose("second")}
          />
        </div>
      )}

      {/* Correct reveal: gap context + continue affordance */}
      <AnimatePresence>
        {correctReveal && round && (
          <motion.button
            type="button"
            onClick={advance}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex min-h-12 w-full cursor-pointer items-center justify-between rounded border-2 px-3 py-2",
              "border-border bg-surface-elevated hover:border-mode-duel-accent/50",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold",
                round.gap <= 10 ? "text-mode-duel-accent" : "text-body-secondary",
              )}
            >
              {round.gap === 1 ? "Only 1 year apart" : `${round.gap} years apart`}
            </span>
            <span className="text-muted-foreground text-xs font-medium">Tap to continue</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Run summary */}
      {status === "over" && (
        <DuelRunSummary
          streak={streak}
          bestStreak={bestStreak}
          isNewBest={isNewBest}
          endReason={endReason}
          finalRound={round}
          onRestart={restart}
        />
      )}

      {/* Screen reader feedback */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

function describeReveal(round: NonNullable<UseDuelGameReturn["round"]>): string {
  const earlier = round.first.year < round.second.year ? round.first : round.second;
  return `${earlier.text} happened first.`;
}
