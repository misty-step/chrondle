"use client";

import React from "react";

import { formatYear, pluralize } from "@/lib/displayFormatting";
import { SCORING_CONSTANTS } from "@/lib/scoring";
import { useShare } from "@/hooks/useShare";
import { generateShareText } from "@/lib/sharing/generator";
import type { RangeGuess } from "@/types/range";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/Separator";
import { Target, Ruler, Lightbulb, Award } from "lucide-react";
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

function calculateHintPenalty(hintsUsed: number): { totalPenalty: number; cappedScore: number } {
  const safeLevel = Math.min(Math.max(hintsUsed, 0), MAX_HINT_INDEX);
  const cappedScore = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[safeLevel];
  return {
    totalPenalty: BASE_POTENTIAL - cappedScore,
    cappedScore,
  };
}

function getWidthStats(range: RangeGuess | undefined, cappedScore: number) {
  if (!range) {
    return {
      width: null,
      retentionPercent: null,
      widthPenalty: 0,
    };
  }

  const width = range.end - range.start + 1;
  const widthFactor = Math.max(
    0,
    Math.min(1, (SCORING_CONSTANTS.W_MAX - width + 1) / SCORING_CONSTANTS.W_MAX),
  );
  const widthPenalty = Math.max(0, cappedScore - Math.floor(cappedScore * widthFactor));

  return {
    width,
    retentionPercent: Math.round(widthFactor * 100),
    widthPenalty,
  };
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
        ? `${formatYear(targetYear)} landed inside your ${pluralize(
            range.end - range.start + 1,
            "year",
          )} window.`
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
  const widthYears = range.end - range.start + 1;
  const contained = range.score > 0;

  return (
    <div className="border-border/40 bg-background/80 rounded-xl border p-3">
      <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs font-medium tracking-wide uppercase">
        <span>Range {index + 1}</span>
        <span className={contained ? "text-green-600" : "text-rose-500"}>
          {contained ? "Contained" : "Missed"}
        </span>
      </div>

      <p className="text-sm font-semibold">
        {formatYear(range.start)} – {formatYear(range.end)}
      </p>
      <p className="text-muted-foreground text-xs">
        {pluralize(widthYears, "year")} wide · {pluralize(range.hintsUsed, "hint")} used ·{" "}
        {range.score} pts
      </p>
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

  const { totalPenalty: hintPenalty, cappedScore } = calculateHintPenalty(hintsUsed);
  const widthStats = getWidthStats(primaryRange, cappedScore);
  const widthFactor = widthStats.width
    ? Math.max(
        0,
        Math.min(1, (SCORING_CONSTANTS.W_MAX - widthStats.width + 1) / SCORING_CONSTANTS.W_MAX),
      )
    : 0;
  const widthScore = Math.floor(cappedScore * widthFactor);
  const finalRangeScore = primaryRange?.score ?? 0;
  const displayedFinalScore = hasWon ? finalRangeScore : 0;
  const outcomeCopy = buildOutcomeCopy(hasWon, primaryRange, targetYear);

  const { share, shareStatus, isSharing } = useShare({
    onSuccess: () => {
      if (hasWon) {
        window.dispatchEvent(new CustomEvent("chrondle:celebrate"));
      }
    },
  });

  const shareText = generateShareText(ranges, totalScore, hasWon, puzzleNumber, {
    targetYear,
  });

  const shareButtonLabel = (() => {
    if (isSharing) return "Sharing…";
    if (shareStatus === "success") return "Copied!";
    if (shareStatus === "error") return "Try again";
    return "Share";
  })();

  const shareButtonTone = (() => {
    if (shareStatus === "success") return "bg-emerald-500 hover:bg-emerald-600";
    if (shareStatus === "error") return "bg-rose-500 hover:bg-rose-600";
    return "bg-primary hover:bg-primary/90";
  })();

  const showTargetMarker = Boolean(
    primaryRange && typeof targetYear === "number" && Number.isFinite(targetYear),
  );
  const missDistance =
    showTargetMarker && primaryRange && typeof targetYear === "number"
      ? targetYear < primaryRange.start
        ? primaryRange.start - targetYear
        : targetYear > primaryRange.end
          ? targetYear - primaryRange.end
          : 0
      : null;

  const missDirection =
    showTargetMarker && primaryRange && typeof targetYear === "number"
      ? targetYear < primaryRange.start
        ? ("earlier" as const)
        : targetYear > primaryRange.end
          ? ("later" as const)
          : ("inside" as const)
      : null;

  const windowYears = primaryRange ? primaryRange.end - primaryRange.start + 1 : 0;

  return (
    <section
      className={cn(
        "border-border/60 bg-card/80 rounded-2xl border p-5 shadow-lg backdrop-blur",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-stretch">
          <div className="border-border/40 bg-background/70 rounded-xl border p-4 shadow-inner">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Game Summary
            </p>
            <h3 className="text-foreground text-2xl font-bold">{outcomeCopy.title}</h3>
          </div>

          <div className="border-border/40 bg-primary/5 rounded-xl border p-4 text-right shadow-sm">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Total Score
            </p>
            <p className="text-primary text-3xl leading-tight font-black">
              {totalScore.toLocaleString()} pts
            </p>
            <p className="text-muted-foreground text-xs">
              {hasWon ? "Contained range" : "Answer outside range"}
            </p>
          </div>
        </div>

        <Button
          onClick={() => share(shareText)}
          disabled={isSharing}
          className={cn(
            "w-full justify-center gap-2 text-sm font-semibold text-white",
            shareButtonTone,
          )}
        >
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
                        ? "fill-yellow-500 text-yellow-600"
                        : "text-muted-foreground/30 fill-none",
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

      <div className="border-border/40 bg-background/70 mt-4 rounded-xl border p-4">
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Score breakdown
        </p>

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler className="text-muted-foreground size-4" aria-hidden="true" />
              <span className="text-muted-foreground">
                Range width ({widthStats.width ? pluralize(widthStats.width, "year") : "—"})
              </span>
            </div>
            <span className="font-mono">
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
            <span className={cn("font-medium", hasWon ? "text-emerald-600" : "text-rose-500")}>
              {hasWon ? "Contained" : "Missed ×0"}
            </span>
          </div>

          <Separator className="border-t-2" />

          {/* Final score */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Award className="size-5" aria-hidden="true" />
              <span className="font-semibold tracking-wide uppercase">Final Score</span>
            </div>
            <span className="text-primary font-mono text-lg font-bold">
              {displayedFinalScore} pts
            </span>
          </div>
        </div>
      </div>

      {/* Puzzle Hints Section */}
      {events && events.length > 0 && (
        <div className="border-border/40 bg-background/70 mt-4 rounded-xl border p-4">
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            Puzzle Hints
          </p>
          <ol className="space-y-2">
            {events.map((event, index) => (
              <li key={index} className="flex items-start gap-3 text-sm">
                <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-medium dark:bg-amber-900/30">
                  {index + 1}
                </span>
                <span className="text-foreground">{event}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {earlierRanges.length > 0 && (
        <div className="border-border/40 bg-background/60 mt-4 rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Previous windows
          </p>
          <div className="mt-3 space-y-2">
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
    </section>
  );
}
