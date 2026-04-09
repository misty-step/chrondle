"use client";

/**
 * ArchiveGrid - Client Component for Timezone-Aware Archive Display
 *
 * Deep Module: Hides local date filtering complexity behind simple props.
 *
 * This component filters archive puzzles based on the user's local date,
 * ensuring users don't see puzzles for future dates (from their timezone's
 * perspective). The server passes all puzzles; this component filters.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Check } from "@phosphor-icons/react";
import { getLocalDateString } from "@/lib/time/dailyDate";
import { formatDate } from "@/lib/displayFormatting";

interface PuzzleData {
  puzzleNumber: number;
  date?: string;
  firstHint: string;
  isCompleted: boolean;
}

interface ArchiveGridProps {
  puzzles: PuzzleData[];
  /** Base path for puzzle links. Default: "/archive/puzzle" for Classic */
  linkPrefix?: string;
  /** Visual mode for accent tokens. Default: "classic" */
  mode?: "classic" | "order" | "groups";
}

export function ArchiveGrid({
  puzzles,
  linkPrefix = "/archive/puzzle",
  mode = "classic",
}: ArchiveGridProps) {
  // Initialize to null to prevent SSR from rendering unfiltered puzzles
  // This avoids layout shift and prevents briefly exposing future puzzle hints
  const [visiblePuzzles, setVisiblePuzzles] = useState<PuzzleData[] | null>(null);

  useEffect(() => {
    const localDate = getLocalDateString();
    setVisiblePuzzles(
      puzzles.filter((p) => {
        if (!p.date) return true;
        return p.date <= localDate;
      }),
    );
  }, [puzzles]);

  // Gate rendering until client-side filtering is complete
  if (visiblePuzzles === null) {
    return null;
  }

  const accentBg =
    mode === "order"
      ? "bg-order-accent"
      : mode === "groups"
        ? "bg-groups-accent"
        : "bg-classic-accent";
  const accentText =
    mode === "order"
      ? "text-order-accent"
      : mode === "groups"
        ? "text-groups-accent"
        : "text-classic-accent";
  const accentBorder =
    mode === "order"
      ? "border-l-order-accent"
      : mode === "groups"
        ? "border-l-groups-accent"
        : "border-l-classic-accent";
  const accentBorderFaded =
    mode === "order"
      ? "border-l-order-accent/80"
      : mode === "groups"
        ? "border-l-groups-accent/80"
        : "border-l-classic-accent/80";
  const completedTint =
    mode === "order"
      ? "bg-order-accent/5"
      : mode === "groups"
        ? "bg-groups-accent/5"
        : "bg-classic-accent/5";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {visiblePuzzles.map((puzzle) => {
        const href = `${linkPrefix}/${puzzle.puzzleNumber}`;

        return (
          <Link key={puzzle.puzzleNumber} href={href}>
            <Card
              className={`border-border bg-surface-elevated shadow-elevation-1 hover:shadow-elevation-2 h-36 cursor-pointer overflow-hidden border-l-[3px] p-3 transition-all duration-150 hover:translate-y-[-2px] sm:h-[10rem] sm:p-4 ${
                puzzle.isCompleted ? `${accentBorder} ${completedTint}` : accentBorderFaded
              }`}
            >
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded ${accentBg} text-xs font-bold text-white`}
                    >
                      {puzzle.puzzleNumber}
                    </span>
                    {puzzle.date && (
                      <span className="text-muted-foreground/80 font-mono text-xs">
                        {formatDate(puzzle.date)}
                      </span>
                    )}
                  </div>
                  {puzzle.isCompleted ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-green-600 text-white">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </div>

                <p className="text-foreground font-event flex-1 overflow-hidden text-base italic">
                  <span className="line-clamp-3">{puzzle.firstHint}</span>
                </p>

                <div className={`mt-auto text-xs font-medium ${accentText}`}>Play puzzle →</div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
