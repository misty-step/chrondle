"use client";

import React from "react";
import { LoadingSpinner } from "@/components/kit/LoadingSpinner";
import { HintText } from "@/components/kit/HintText";

interface CurrentHintCardProps {
  event: string | null;
  hintNumber: number;
  totalHints: number;
  isLoading: boolean;
  error: string | null;
}

export const CurrentHintCard: React.FC<CurrentHintCardProps> = React.memo(
  ({ event, hintNumber, totalHints, isLoading, error }) => {
    if (error) return null;

    return (
      <div className="border-border w-full border-y py-5 sm:py-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-feedback-success font-semibold">Current clue</span>
          <span
            className="text-muted-foreground tabular-nums"
            aria-label={`Hint ${hintNumber} of ${totalHints}`}
          >
            {hintNumber} of {totalHints}
          </span>
        </div>

        <div role="status" aria-live="polite" aria-atomic="true" aria-busy={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-3 py-2">
              <LoadingSpinner size="sm" className="motion-reduce:animate-none" />
              <span className="font-body text-muted-foreground text-base">Loading hint...</span>
            </div>
          ) : (
            <HintText className="font-body text-foreground text-left text-lg leading-relaxed font-normal sm:text-xl sm:leading-relaxed">
              {event || "[DATA MISSING]"}
            </HintText>
          )}
        </div>
      </div>
    );
  },
);

CurrentHintCard.displayName = "CurrentHintCard";
