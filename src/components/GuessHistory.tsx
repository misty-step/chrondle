"use client";

import React from "react";
import { formatYear } from "@/lib/displayFormatting";
import { Badge } from "@/components/ui/Badge";

interface GuessHistoryProps {
  guesses: number[];
  targetYear: number;
  events: string[];
  className?: string;
}

interface GuessRowProps {
  guess: number;
  targetYear: number;
  hint: string;
  index: number;
}

const GuessRow: React.FC<GuessRowProps> = React.memo(({ guess, targetYear, hint, index }) => {
  const isCorrect = guess === targetYear;

  if (isCorrect) {
    return (
      <div className="border-feedback-success/30 bg-feedback-success/10 dark:border-feedback-success/40 dark:bg-feedback-success/20 flex items-center justify-between rounded border p-4">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm font-medium">#{index + 1}</span>
          <Badge variant="default" className="bg-feedback-success hover:bg-feedback-success-hover">
            CORRECT
          </Badge>
          <span className="font-accent text-lg font-bold tracking-wide">{formatYear(guess)}</span>
        </div>
        <span className="text-feedback-success font-semibold">You won!</span>
      </div>
    );
  }

  const isEarlier = guess > targetYear;
  const badgeVariant = isEarlier ? "earlier" : "later";
  const badgeText = isEarlier ? "EARLIER" : "LATER";

  return (
    <div className="bg-card space-y-3 rounded border p-4">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm font-medium">#{index + 1}</span>
        <Badge variant={badgeVariant} className="px-3 py-1 text-sm">
          {badgeText}
        </Badge>
        <span className="font-accent text-lg font-semibold tracking-wide">{formatYear(guess)}</span>
      </div>

      {hint && (
        <div className="pl-8">
          <p className="text-muted-foreground font-body text-sm">
            <span className="font-accent font-medium">Next hint:</span> {hint}
          </p>
        </div>
      )}
    </div>
  );
});

GuessRow.displayName = "GuessRow";

export const GuessHistory: React.FC<GuessHistoryProps> = React.memo(
  ({ guesses, targetYear, events, className = "" }) => {
    if (guesses.length === 0) {
      return null;
    }

    return (
      <div
        className={className}
        role="region"
        aria-label={`Your ${guesses.length} previous guess${guesses.length === 1 ? "" : "es"}`}
      >
        <div className="mb-4">
          <h3
            className="font-heading mb-2 text-xl font-bold"
            style={{ color: "var(--foreground)" }}
            id="guess-history-heading"
          >
            Your Guesses
          </h3>
          <div className="h-px w-full" style={{ background: "var(--border)" }} />
        </div>

        <div className="space-y-3" role="list" aria-labelledby="guess-history-heading">
          {guesses.map((guess, index) => {
            const hint = events[index + 1] || "";

            return (
              <GuessRow
                key={`${guess}-${index}`}
                guess={guess}
                targetYear={targetYear}
                hint={hint}
                index={index}
              />
            );
          })}
        </div>
      </div>
    );
  },
);

GuessHistory.displayName = "GuessHistory";

// why-did-you-render tracking
if (process.env.NODE_ENV === "development") {
  (GuessHistory as any).whyDidYouRender = true;
}
