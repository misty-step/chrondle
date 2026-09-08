"use client";

import React, { useId, useState } from "react";

import { formatYear, pluralize } from "@/lib/displayFormatting";
import { SCORING_CONSTANTS, computeScoreBreakdown } from "@/lib/scoring";
import { useShareGame } from "@/hooks/useShareGame";
import type { HintCount, RangeGuess } from "@/types/range";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/kit/Separator";
import {
  Target,
  Ruler,
  Lightbulb,
  Medal,
  CaretDown,
  Check,
  WarningCircle,
} from "@/components/kit/icons";
import { RangeProximity } from "@/components/game/RangeProximity";

interface GameCompleteProps {
  ranges: RangeGuess[];
  totalScore: number;
  hasWon: boolean;
  puzzleNumber?: number;
  className?: string;
  targetYear?: number;
  totalHints?: number;
  events?: string[];
}

const BASE_POTENTIAL = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[0];
const MAX_HINT_INDEX = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS.length - 1;

function clampHintCount(hintsUsed: number): HintCount {
  return Math.min(Math.max(Math.floor(hintsUsed), 0), MAX_HINT_INDEX) as HintCount;
}

function cappedScoreFor(hintsUsed: number): number {
  return SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[clampHintCount(hintsUsed)];
}

/**
 * Breakdown of the primary range using the real scoring curve
 * (computeScoreBreakdown), so the explanation always equals the final score.
 */
function getBreakdown(range: RangeGuess | undefined) {
  if (!range || range.end < range.start) {
    return null;
  }

  try {
    return computeScoreBreakdown(range.start, range.end, clampHintCount(range.hintsUsed ?? 0));
  } catch {
    // Defensive: legacy/corrupt ranges (e.g. width beyond W_MAX) — hide the
    // breakdown rather than show wrong math.
    return null;
  }
}

function describeMiss(range: RangeGuess, targetYear?: number): string | null {
  if (typeof targetYear !== "number" || Number.isNaN(targetYear)) {
    return null;
  }

  if (targetYear < range.start) {
    const diff = range.start - targetYear;
    return `${formatYear(targetYear)} was ${pluralize(diff, "year")} earlier than your start.`;
  }

  if (targetYear > range.end) {
    const diff = targetYear - range.end;
    return `${formatYear(targetYear)} was ${pluralize(diff, "year")} later than your end.`;
  }

  return null;
}

function buildOutcomeCopy(
  hasWon: boolean,
  range: RangeGuess | undefined,
  targetYear?: number,
): { title: string; detail: string | null } {
  if (!range) {
    return {
      title: "No range submitted",
      detail: "Lock in a range to see how close you were.",
    };
  }

  if (hasWon) {
    const detail =
      typeof targetYear === "number" && !Number.isNaN(targetYear)
        ? `${formatYear(targetYear)} fell within your ${range.end - range.start + 1}-year range.`
        : "Your range captured the target year.";

    return {
      title: "Range contained the answer",
      detail,
    };
  }

  return {
    title: "Answer escaped your range",
    detail: describeMiss(range, targetYear) || "The target year fell outside your window.",
  };
}

function RangeSummary({ range, index }: { range: RangeGuess; index: number }) {
  const width = range.end - range.start + 1;
  return (
    <div className="border-border border-t py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-foreground font-semibold">Attempt {index + 1}</span>
        <span className="text-foreground font-mono tabular-nums">
          {formatYear(range.start)} - {formatYear(range.end)}
        </span>
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>Width: {width.toLocaleString()} years</span>
        <span className="text-foreground font-semibold">
          Score: {range.score.toLocaleString()} pts
        </span>
      </div>
    </div>
  );
}

export function GameComplete({
  ranges,
  totalScore,
  hasWon,
  puzzleNumber,
  targetYear,
  totalHints,
  events,
  className,
}: GameCompleteProps) {
  const primaryRange = ranges[ranges.length - 1];
  const earlierRanges = ranges.length > 1 ? ranges.slice(0, -1) : [];
  const hintsUsed = primaryRange?.hintsUsed ?? 0;

  const optionalHintSlots =
    typeof totalHints === "number" && totalHints > 0 ? Math.max(totalHints - 1, 0) : null;
  const ladderSlots = optionalHintSlots ?? Math.max(hintsUsed, 1);
  const ladderFilled = Math.min(hintsUsed, ladderSlots);

  const breakdown = getBreakdown(primaryRange);
  const hintPenalty = breakdown?.hintPenalty ?? BASE_POTENTIAL - cappedScoreFor(hintsUsed);
  const cappedScore = breakdown?.cappedScore ?? cappedScoreFor(hintsUsed);
  const widthFactor = breakdown?.widthFactor ?? 0;
  const widthScore = breakdown?.potentialScore ?? 0;
  const finalRangeScore = primaryRange?.score ?? 0;
  const displayedFinalScore = hasWon ? finalRangeScore : 0;
  const outcomeCopy = buildOutcomeCopy(hasWon, primaryRange, targetYear);

  const showTargetMarker = Boolean(
    primaryRange && typeof targetYear === "number" && Number.isFinite(targetYear),
  );
  let missDistance: number | null = null;
  let missDirection: "earlier" | "later" | null = null;

  if (!hasWon && showTargetMarker && primaryRange && typeof targetYear === "number") {
    if (targetYear < primaryRange.start) {
      missDistance = primaryRange.start - targetYear;
      missDirection = "earlier";
    } else if (targetYear > primaryRange.end) {
      missDistance = targetYear - primaryRange.end;
      missDirection = "later";
    }
  }

  const { shareGame, shareStatus, isSharing } = useShareGame(
    ranges,
    totalScore,
    hasWon,
    puzzleNumber,
    {
      missDistance,
      missDirection,
    },
  );

  const shareButtonLabel = (() => {
    if (isSharing) return "Sharing…";
    if (shareStatus === "success") return "Copied!";
    if (shareStatus === "error") return "Try again";
    return "Share";
  })();

  // Share feedback is immediate and stays quiet.
  const shareButtonIcon = (() => {
    if (shareStatus === "success") return <Check className="size-4" aria-hidden="true" />;
    if (shareStatus === "error") return <WarningCircle className="size-4" />;
    return null;
  })();

  const windowYears = primaryRange ? primaryRange.end - primaryRange.start + 1 : 0;

  // Progressive disclosure - details collapsed by default
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();

  return (
    <section className={cn("border-border bg-card rounded-2xl border p-5 sm:p-6", className)}>
      <div className="mb-6 flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-start">
          <div>
            <h3 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              {outcomeCopy.title}
            </h3>
            {outcomeCopy.detail && (
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {outcomeCopy.detail}
              </p>
            )}
          </div>

          <div className="sm:border-border sm:border-l sm:pl-5 sm:text-right">
            <p className="text-muted-foreground text-sm">Total score</p>
            <p
              className={cn(
                "mt-1 text-3xl leading-tight font-semibold tabular-nums",
                hasWon ? "text-feedback-success" : "text-muted-foreground",
              )}
            >
              {totalScore.toLocaleString()} pts
            </p>
          </div>
        </div>

        <Button
          onClick={() => shareGame()}
          disabled={isSharing}
          size="lg"
          className="text-feedback-success-foreground w-full justify-center gap-2 text-base"
        >
          {shareButtonIcon}
          {shareButtonLabel}
        </Button>
      </div>

      {primaryRange && (
        <RangeProximity
          rangeStart={primaryRange.start}
          rangeEnd={primaryRange.end}
          targetYear={typeof targetYear === "number" ? targetYear : undefined}
          missDistance={missDistance}
          missDirection={missDirection}
          windowYears={windowYears}
        >
          {ladderSlots > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground text-xs">Hints taken</span>
              <div className="flex items-center gap-2">
                {Array.from({ length: ladderSlots }).map((_, index) => (
                  <Lightbulb
                    key={index}
                    className={cn(
                      "size-4",
                      index < ladderFilled
                        ? "fill-feedback-success/15 text-feedback-success"
                        : "text-muted-foreground/50 fill-none",
                    )}
                    aria-label={index < ladderFilled ? "Hint used" : "Hint unused"}
                  />
                ))}
              </div>
              <span className="text-foreground font-medium">-{hintPenalty} pts</span>
            </div>
          )}
        </RangeProximity>
      )}

      {/* Progressive disclosure toggle */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
        aria-expanded={showDetails}
        aria-controls={detailsId}
      >
        <span>{showDetails ? "Hide details" : "Show score breakdown"}</span>
        <CaretDown
          className={cn(
            "size-4 transition-transform duration-200 motion-reduce:transition-none",
            showDetails && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {showDetails && (
        <div id={detailsId}>
          <div className="border-border mt-2 border-t pt-4">
            <p className="text-foreground mb-4 text-sm font-semibold">Score breakdown</p>

            <div className="space-y-3 text-sm">
              {/* Base potential */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base potential</span>
                <span className="font-mono">{BASE_POTENTIAL} pts</span>
              </div>

              <Separator />

              {/* Hints with subtotal */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="text-muted-foreground size-4" aria-hidden="true" />
                    <span className="text-muted-foreground">Hints revealed ({hintsUsed})</span>
                  </div>
                  <span className="font-mono">-{hintPenalty} pts</span>
                </div>
                <div className="flex items-center justify-end pl-6">
                  <span className="text-muted-foreground text-xs">Subtotal: </span>
                  <span className="ml-2 font-mono text-xs">{cappedScore} pts</span>
                </div>
              </div>

              <Separator />

              {/* Width calculation */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Ruler className="text-muted-foreground size-4" aria-hidden="true" />
                  <span className="text-muted-foreground">
                    Range width ({breakdown ? pluralize(breakdown.width, "year") : "—"})
                  </span>
                </div>
                <span className="font-mono whitespace-nowrap">
                  {cappedScore} × {widthFactor.toFixed(2)} = {widthScore}
                </span>
              </div>

              <Separator />

              {/* Containment */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="text-muted-foreground size-4" aria-hidden="true" />
                  <span className="text-muted-foreground">Containment</span>
                </div>
                <span
                  className={cn(
                    "font-medium",
                    hasWon ? "text-feedback-success" : "text-destructive",
                  )}
                >
                  {hasWon ? "Contained" : "Missed ×0"}
                </span>
              </div>

              <Separator className="border-t-2" />

              {/* Final score */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Medal className="size-5" aria-hidden="true" />
                  <span className="font-semibold">Final score</span>
                </div>
                <span className="text-body-primary font-mono text-lg font-bold">
                  {displayedFinalScore} pts
                </span>
              </div>
            </div>
          </div>

          {/* Puzzle Hints Section */}
          {events && events.length > 0 && (
            <div className="border-border mt-5 border-t pt-4">
              <p className="text-foreground mb-3 text-sm font-semibold">Puzzle hints</p>
              <ol className="divide-border divide-y">
                {events.map((event, index) => (
                  <li key={index} className="flex items-start gap-3 py-3 text-sm leading-relaxed">
                    <span className="text-muted-foreground w-5 shrink-0 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="text-foreground">{event}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {earlierRanges.length > 0 && (
            <div className="mt-5">
              <p className="text-foreground text-sm font-semibold">Previous windows</p>
              <div className="mt-3">
                {earlierRanges.map((range, index) => (
                  <RangeSummary
                    key={`${range.start}-${range.timestamp ?? index}`}
                    range={range}
                    index={index}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
