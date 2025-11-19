import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import { SCORING_CONSTANTS } from "@/lib/scoring";
import { formatYearWithOptions } from "@/lib/displayFormatting";

export interface RangePreviewProps {
  start: number;
  end: number;
  width: number;
  hintsUsed: number;
  className?: string;
}

export function RangePreview({ start, end, width, hintsUsed, className }: RangePreviewProps) {
  // Calculate max possible score with flat deduction system
  // Clamp to 0 to prevent negative scores when range exceeds W_MAX
  const maxPossibleScore = useMemo(() => {
    const maxScoreForHints = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[hintsUsed];
    const widthFactor = (SCORING_CONSTANTS.W_MAX - width + 1) / SCORING_CONSTANTS.W_MAX;
    return Math.max(0, Math.floor(maxScoreForHints * widthFactor));
  }, [width, hintsUsed]);

  // Calculate theoretical best (narrowest range, no hints)
  const theoreticalMax = useMemo(() => {
    return SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[0]; // 100 points for 0 hints, 1-year range
  }, []);

  // Format years for display
  const startFormatted = formatYearWithOptions(start);
  const endFormatted = formatYearWithOptions(end);

  // Determine if range is valid
  const isValid = width <= SCORING_CONSTANTS.W_MAX;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Range display */}
      <div className="text-muted-foreground flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {startFormatted} – {endFormatted}
        </span>
        <span className="text-muted-foreground/70 text-xs">{width} years</span>
      </div>

      {/* Prominent Score Display */}
      {isValid ? (
        <div className="bg-primary/10 border-primary/30 flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-muted-foreground text-sm font-medium">Potential Score</span>
          <span className="text-primary text-xl font-bold tabular-nums">
            {maxPossibleScore} pts
          </span>
        </div>
      ) : (
        <div className="bg-muted/50 border-muted flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-muted-foreground text-sm font-medium">Range too wide</span>
          <span className="text-muted-foreground/70 text-sm tabular-nums">
            max {theoreticalMax} pts
          </span>
        </div>
      )}
    </div>
  );
}
