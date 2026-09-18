"use client";

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

/** Additional clues taken and the next-clue action. */
export function HintIndicator({
  hintsRevealed,
  totalHints,
  onRevealHint,
  disabled = false,
  className,
}: HintIndicatorProps) {
  const numberOfHintMarks = Math.max(0, totalHints - 1);
  const hasMoreHints = hintsRevealed < numberOfHintMarks;

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-4", className)}>
      {/* Progress marks count only the additional clues. */}
      <div
        className="flex items-center gap-1.5"
        role="img"
        aria-label={`${hintsRevealed} of ${numberOfHintMarks} hints revealed`}
      >
        {Array.from({ length: numberOfHintMarks }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              i < hintsRevealed ? "bg-feedback-success" : "border-muted-foreground/50 border",
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      {hasMoreHints && (
        <Button
          variant="outline"
          size="default"
          onClick={onRevealHint}
          disabled={disabled}
          soundCue="chime"
          className="hover:border-feedback-success hover:text-feedback-success h-11 px-4 text-sm"
        >
          Take hint
        </Button>
      )}
    </div>
  );
}
