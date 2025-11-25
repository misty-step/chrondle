"use client";

import React from "react";
import { TextAnimate } from "@/components/magicui/text-animate";

interface CelebrationHeaderProps {
  hasWon: boolean;
  guesses: number[];
  timeString: string;
}

export const CelebrationHeader: React.FC<CelebrationHeaderProps> = ({
  hasWon,
  guesses,
  timeString,
}) => {
  const getCelebrationTitle = () => {
    if (!hasWon) {
      return "So close!";
    }

    const guessCount = guesses.length;

    if (guessCount === 1) {
      return "INCREDIBLE!";
    } else if (guessCount <= 2) {
      return "AMAZING!";
    } else if (guessCount <= 4) {
      return "NICE WORK!";
    } else {
      return "GOT IT!";
    }
  };

  const celebrationTitle = getCelebrationTitle();

  return (
    <div className="space-y-4 py-4 text-center">
      {/* Celebration Title */}
      <TextAnimate
        animation="fadeIn"
        by="word"
        delay={0.1}
        className="text-foreground text-3xl font-bold"
      >
        {celebrationTitle}
      </TextAnimate>

      {/* Countdown Badge */}
      <div className="bg-primary/5 border-primary/20 inline-flex items-center gap-3 rounded-sm border px-4 py-2">
        <div className="text-muted-foreground text-xs tracking-wide uppercase">Next puzzle</div>
        <div className="text-primary font-mono text-sm font-bold">{timeString}</div>
      </div>
    </div>
  );
};
