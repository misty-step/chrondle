"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowCounterClockwise, Check, Trophy, WarningCircle } from "@/components/kit/icons";

import { Button } from "@/components/ui/button";
import { KeepPlaying } from "@/components/KeepPlaying";
import { useWebShare } from "@/hooks/useWebShare";
import { generateDuelShareText } from "@/lib/duel/share";
import { useReducedMotion } from "@/lib/animationConstants";
import { cn } from "@/lib/utils";
import type { DuelRoundView } from "@/lib/duel/runReducer";

interface DuelRunSummaryProps {
  streak: number;
  bestStreak: number;
  isNewBest: boolean;
  endReason: "miss" | "exhausted" | null;
  finalRound: DuelRoundView | null;
  onRestart: () => void;
}

type ShareStatus = "idle" | "success" | "error";

export function DuelRunSummary({
  streak,
  bestStreak,
  isNewBest,
  endReason,
  finalRound,
  onRestart,
}: DuelRunSummaryProps) {
  const prefersReducedMotion = useReducedMotion();
  const { share, isSharing } = useWebShare();
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (shareStatus === "idle") return;
    const timer = setTimeout(() => setShareStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  const handleShare = async () => {
    const text = generateDuelShareText({
      streak,
      bestStreak,
      tierLabel: finalRound?.tierLabel ?? "Novice",
      finalGap: endReason === "miss" ? (finalRound?.gap ?? null) : null,
    });
    const success = await share(text);
    setShareStatus(success ? "success" : "error");
  };

  const gapLine =
    endReason === "miss" && finalRound
      ? finalRound.gap === 1
        ? "The gap was a single year."
        : `The gap was ${finalRound.gap} years.`
      : endReason === "exhausted"
        ? "You emptied the archive. Genuinely impressive."
        : null;

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="border-border/60 bg-card space-y-5 rounded border p-5 shadow-lg sm:p-6"
    >
      <div className="space-y-1 text-center">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Run over
        </p>
        <p className="text-body-primary font-display text-5xl font-bold tabular-nums sm:text-6xl">
          {streak}
        </p>
        <p className="text-body-secondary text-sm font-medium">
          {streak === 1 ? "event called correctly" : "events called correctly"}
          {finalRound ? ` · ${finalRound.tierLabel} rank` : ""}
        </p>
        {gapLine && <p className="text-muted-foreground text-sm">{gapLine}</p>}
      </div>

      <div className="flex items-center justify-center gap-2">
        {isNewBest ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded border-2 px-3 py-1",
              "border-mode-duel-accent/40 text-mode-duel-accent text-sm font-bold",
            )}
          >
            <Trophy className="size-4" aria-hidden="true" weight="fill" />
            New personal best
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">
            Best run: <span className="text-body-primary font-bold">{bestStreak}</span>
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Button
          onClick={onRestart}
          size="lg"
          className={cn(
            "h-14 w-full rounded text-lg font-bold tracking-wide text-white",
            "border-2 border-[var(--mode-duel-accent)] bg-[var(--mode-duel-accent)]",
            "dark:text-background hover:opacity-90",
          )}
        >
          <ArrowCounterClockwise className="size-5" aria-hidden="true" />
          Play Again
        </Button>

        <Button
          onClick={handleShare}
          disabled={isSharing}
          variant="outline"
          className="h-11 w-full justify-center gap-2 text-sm font-semibold"
        >
          {shareStatus === "success" && <Check className="size-4" aria-hidden="true" />}
          {shareStatus === "error" && <WarningCircle className="size-4" aria-hidden="true" />}
          {isSharing
            ? "Sharing…"
            : shareStatus === "success"
              ? "Copied!"
              : shareStatus === "error"
                ? "Try again"
                : "Share"}
        </Button>
      </div>

      <KeepPlaying currentMode="duel" />
    </motion.section>
  );
}
