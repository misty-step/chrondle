import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HintIndicatorProps {
  hintsRevealed: number; // 0-5 (number of additional hints revealed beyond the first event)
  totalHints: number; // Total number of events (usually 6)
  onRevealHint: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Archival hint progress indicator with stamp marks and document unlock button.
 *
 * Shows filled stamps for revealed hints and empty frames for remaining hints.
 * Only displays the "Unlock Hint" button when more hints are available.
 *
 * Note: The first event is the puzzle itself (not a hint), so we show
 * totalHints - 1 marks (5 marks for 6 total events).
 */
export function HintIndicator({
  hintsRevealed,
  totalHints,
  onRevealHint,
  disabled = false,
  className,
}: HintIndicatorProps) {
  // First event is always shown and doesn't count as a hint
  const numberOfHintCircles = totalHints - 1;
  const hasMoreHints = hintsRevealed < numberOfHintCircles;

  return (
    <div className={cn("flex items-center justify-end gap-4", className)}>
      {/* Stamp indicators - 5 marks for 5 additional hints (not counting the puzzle event) */}
      <div
        className="flex gap-2"
        role="img"
        aria-label={`${hintsRevealed} of ${numberOfHintCircles} hints revealed`}
      >
        {Array.from({ length: numberOfHintCircles }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3.5 w-3.5 rounded-[1px] border-2 transition-all duration-300",
              i < hintsRevealed
                ? "bg-vermilion-500 border-vermilion-600 shadow-sm"
                : "border-muted-foreground/40 bg-transparent",
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Archival unlock button - only show if more hints available */}
      {hasMoreHints && (
        <Button
          variant="outline"
          size="default"
          onClick={onRevealHint}
          disabled={disabled}
          className="hover:border-vermilion-500 hover:text-vermilion-500 h-10 rounded-sm border-2 px-4 text-sm font-semibold transition-colors"
        >
          Take Hint
        </Button>
      )}
    </div>
  );
}
