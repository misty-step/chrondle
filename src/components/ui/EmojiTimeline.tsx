"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface EmojiTimelineProps {
  timeline: string;
  guesses: number[];
  targetYear: number;
  className?: string;
  showTooltips?: boolean;
}

export const EmojiTimeline: React.FC<EmojiTimelineProps> = ({
  timeline,
  guesses,
  targetYear,
  className,
  showTooltips = false,
}) => {
  const emojis = timeline.split("");

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      {emojis.map((emoji, index) => {
        const guess = guesses[index];
        const distance = Math.abs(guess - targetYear);
        const isCorrect = guess === targetYear;

        return (
          <div
            key={index}
            className={cn(
              "group relative transition-transform duration-200",
              isCorrect && "animate-bounce-once",
            )}
          >
            <span
              className={cn(
                "inline-block text-2xl transition-transform duration-200",
                "group-hover:scale-125",
                isCorrect && "animate-pulse",
              )}
              role="img"
              aria-label={`Guess ${index + 1}: ${isCorrect ? "Correct" : `${distance} years off`}`}
            >
              {emoji}
            </span>

            {/* Tooltip on hover */}
            {showTooltips && (
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 transform opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="rounded bg-gray-900 px-2 py-1 text-xs whitespace-nowrap text-white">
                  {isCorrect ? "Correct!" : `${distance} years off`}
                </div>
                <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 transform">
                  <div className="border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
