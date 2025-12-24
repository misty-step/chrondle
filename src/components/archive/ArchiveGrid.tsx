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

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Check } from "lucide-react";
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
}

export function ArchiveGrid({ puzzles, linkPrefix = "/archive/puzzle" }: ArchiveGridProps) {
  // Track local date for filtering (client-only)
  const [localDate, setLocalDate] = useState<string | null>(null);

  useEffect(() => {
    setLocalDate(getLocalDateString());
  }, []);

  // Filter puzzles to only show those up to user's local date
  const filteredPuzzles = useMemo(() => {
    if (!localDate) {
      // During SSR/hydration, show all (server rendered this)
      return puzzles;
    }

    return puzzles.filter((p) => {
      // No date = show (legacy data)
      if (!p.date) return true;
      // Only show puzzles dated <= user's local date
      return p.date <= localDate;
    });
  }, [puzzles, localDate]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {filteredPuzzles.map((puzzle) => (
        <Link key={puzzle.puzzleNumber} href={`${linkPrefix}/${puzzle.puzzleNumber}`}>
          <Card
            className={`flex h-36 cursor-pointer flex-col gap-2 p-3 transition-all hover:shadow-md sm:h-[10rem] sm:p-4 ${
              puzzle.isCompleted
                ? "border-green-600/30 bg-green-600/5 hover:border-green-600/50"
                : "hover:border-primary"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-muted-foreground font-mono text-sm">
                  Puzzle #{puzzle.puzzleNumber}
                </span>
                {puzzle.date && (
                  <span className="text-muted-foreground/60 text-xs">
                    {formatDate(puzzle.date)}
                  </span>
                )}
              </div>
              {puzzle.isCompleted && <Check className="h-4 w-4 text-green-600" />}
            </div>

            <p className="text-foreground flex-1 overflow-hidden text-sm">
              <span className="line-clamp-3">{puzzle.firstHint}</span>
            </p>

            <div className="text-muted-foreground mt-auto text-xs">Play puzzle →</div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
