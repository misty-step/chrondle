"use client";

import React from "react";
import { formatYear } from "@/lib/displayFormatting";
import { HistoricalContextCard } from "@/components/HistoricalContextCard";
import type { ClosestGuessData } from "@/types/game";

interface GameInstructionsProps {
  className?: string;
  isGameComplete?: boolean;
  hasWon?: boolean;
  targetYear?: number;
  timeString?: string;
  currentStreak?: number;
  closestGuess?: ClosestGuessData | null;
  isArchive?: boolean;
  historicalContext?: string;
}

export const GameInstructions: React.FC<GameInstructionsProps> = ({
  className = "",
  isGameComplete = false,
  hasWon = false,
  targetYear,
  timeString,
  historicalContext,
  closestGuess,
  isArchive = false,
}) => {
  // Active game state - show normal instructions
  if (!isGameComplete) {
    return (
      <div className={`text-left ${className}`}>
        <h2 className="text-foreground font-display mb-2 text-2xl sm:text-3xl lg:text-4xl">
          Date This Event
        </h2>
        <p className="text-muted-foreground text-base leading-relaxed font-medium sm:text-lg lg:text-xl">
          Narrow your range to score more.
        </p>
      </div>
    );
  }

  return (
    <div className={`mb-1 ${className}`}>
      {/* Answer Reveal Section - Compact for Loss State */}
      {!hasWon && targetYear && (
        <div className="rounded-card border-feedback-error/20 from-feedback-error/5 to-feedback-error/10 mb-6 flex w-full items-center gap-4 border bg-gradient-to-br p-6">
          <div className="flex flex-1 flex-col items-start">
            <div className="text-feedback-error mb-1 text-xs font-medium tracking-wide uppercase">
              The answer was
            </div>
            <div className="text-feedback-error text-2xl font-bold sm:text-3xl">
              {formatYear(targetYear)}
            </div>
            {/* Show closest guess information if available */}
            {closestGuess && (
              <div className="text-feedback-error/80 mt-1 text-sm">
                Your closest: {formatYear(closestGuess.guess)} ({closestGuess.distance} year
                {closestGuess.distance === 1 ? "" : "s"} off)
              </div>
            )}
          </div>

          <div className="text-feedback-error text-sm font-medium">Better luck tomorrow!</div>
        </div>
      )}

      {/* Success State - Show answer with celebration */}
      {hasWon && targetYear && (
        <div className="rounded-card border-feedback-success/20 from-feedback-success/5 to-feedback-success/10 mb-6 flex w-full items-center gap-4 border bg-gradient-to-br p-6">
          <div className="flex flex-1 flex-col items-start">
            <div className="text-feedback-success mb-1 text-xs font-medium tracking-wide uppercase">
              The year was
            </div>
            <div className="text-feedback-success text-2xl font-bold sm:text-3xl">
              {formatYear(targetYear)}
            </div>
          </div>

          <div className="text-feedback-success flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">Great job!</span>
          </div>
        </div>
      )}

      {/* Conditional Layout: Show countdown for daily puzzles, compact share for archive */}
      {!isArchive && (
        <div className="from-primary/5 to-primary/10 border-primary/20 rounded-card mb-4 flex w-full items-center gap-4 border bg-gradient-to-br p-6">
          <div className="flex flex-1 flex-col items-start">
            <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              Next puzzle in
            </div>
            <div className="text-body-primary font-mono text-2xl font-bold sm:text-3xl">
              {timeString || "00:00:00"}
            </div>
          </div>
        </div>
      )}

      {/* Historical Context Card - Below the next puzzle section */}
      <HistoricalContextCard
        context={isGameComplete ? historicalContext : undefined}
        className=""
      />
    </div>
  );
};
