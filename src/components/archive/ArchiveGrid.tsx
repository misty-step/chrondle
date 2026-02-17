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
import { Check, Lock } from "lucide-react";
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
  /** Whether user has archive access (subscription). If false, shows lock icons. */
  hasAccess?: boolean;
  /** Visual mode for accent tokens. Default: "classic" */
  mode?: "classic" | "order";
}

export function ArchiveGrid({
  puzzles,
  linkPrefix = "/archive/puzzle",
  hasAccess = true,
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

  const accentBg = mode === "order" ? "bg-order-accent" : "bg-classic-accent";
  const accentText = mode === "order" ? "text-order-accent" : "text-classic-accent";
  const accentBorder = mode === "order" ? "border-l-order-accent" : "border-l-classic-accent";
  const accentBorderFaded =
    mode === "order" ? "border-l-order-accent/80" : "border-l-classic-accent/80";
  const completedTint = mode === "order" ? "bg-order-accent/5" : "bg-classic-accent/5";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {visiblePuzzles.map((puzzle) => {
        // Determine link destination: if no access, go to pricing
        const href = hasAccess ? `${linkPrefix}/${puzzle.puzzleNumber}` : "/pricing";

        return (
          <Link key={puzzle.puzzleNumber} href={href}>
            <Card
              className={`border-border bg-surface-elevated shadow-elevation-1 hover:shadow-elevation-2 h-36 cursor-pointer overflow-hidden border-l-[3px] p-3 transition-all duration-150 hover:translate-y-[-2px] sm:h-[10rem] sm:p-4 ${
                puzzle.isCompleted
                  ? `${accentBorder} ${completedTint}`
                  : hasAccess
                    ? accentBorderFaded
                    : "border-l-muted-foreground/30"
              }`}
            >
              <div className={`flex h-full flex-col gap-2 ${hasAccess ? "" : "opacity-70"}`}>
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
                  ) : !hasAccess ? (
                    <Lock className="text-muted-foreground/70 h-4 w-4" />
                  ) : null}
                </div>

                <p className="text-foreground font-event flex-1 overflow-hidden text-base italic">
                  <span className="line-clamp-3">{puzzle.firstHint}</span>
                </p>

                <div className={`mt-auto text-xs font-medium ${accentText}`}>
                  {hasAccess ? "Play puzzle →" : "Unlock archive →"}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
