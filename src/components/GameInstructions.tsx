"use client";

import React from "react";
import { formatYear } from "@/lib/displayFormatting";
import { cn } from "@/lib/utils";

interface GameInstructionsProps {
  className?: string;
  isGameComplete?: boolean;
  hasWon?: boolean;
  targetYear?: number;
}

export const GameInstructions: React.FC<GameInstructionsProps> = ({
  className,
  isGameComplete = false,
  hasWon = false,
  targetYear,
}) => {
  if (!isGameComplete) {
    return (
      <div className={className}>
        <h1 className="font-display text-foreground text-2xl font-semibold sm:text-3xl">
          Date this event
        </h1>
        <p className="text-muted-foreground mt-2 text-base leading-relaxed">
          Narrow your range to score more.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-muted-foreground mb-2 text-sm">The year was</p>
      <h1
        className={cn(
          "font-display text-3xl font-semibold sm:text-4xl",
          hasWon ? "text-feedback-success" : "text-foreground",
        )}
      >
        {typeof targetYear === "number" ? formatYear(targetYear) : "Puzzle complete"}
      </h1>
    </div>
  );
};
