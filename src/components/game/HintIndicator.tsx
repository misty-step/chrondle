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
 * Minimal hint progress indicator with subtle dots and compact button.
 * Inspired by Minute Cryptic's clean UI approach.
 *
 * Shows filled dots for revealed hints and empty dots for remaining hints.
 * Only displays the "Get Hint" button when more hints are available.
 *
 * Note: The first event is the puzzle itself (not a hint), so we show
 * totalHints - 1 circles (5 circles for 6 total events).
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
    <div className={cn("flex items-center justify-start gap-4", className)}>
      {/* Dot indicators - 5 circles for 5 additional hints (not counting the puzzle event) */}
      <div
        className="flex gap-2"
        role="img"
        aria-label={`${hintsRevealed} of ${numberOfHintCircles} hints revealed`}
      >
        {Array.from({ length: numberOfHintCircles }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 w-3 rounded-full transition-colors duration-300",
              i < hintsRevealed ? "bg-primary" : "bg-muted-foreground/30",
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Prominent button - only show if more hints available */}
      {hasMoreHints && (
        <Button
          variant="outline"
          size="default"
          onClick={onRevealHint}
          disabled={disabled}
          className="h-10 px-4 text-sm font-semibold"
        >
          Get Hint
        </Button>
      )}
    </div>
  );
}
