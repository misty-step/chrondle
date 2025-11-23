"use client";

import React from "react";

interface GameProgressProps {
  guessCount?: number;
  totalHints?: number;
  className?: string;
}

export const GameProgress: React.FC<GameProgressProps> = ({
  guessCount = 0,
  totalHints = 6,
  className = "",
}) => {
  const remainingGuesses = Math.max(0, totalHints - guessCount);

  return (
    <div className={`flex items-center justify-start gap-2 py-2 ${className}`}>
      <span className="text-muted-foreground mr-2 text-sm font-medium">Guesses Remaining:</span>
      <div
        className="flex items-center gap-2"
        aria-label={`Guesses remaining: ${remainingGuesses}`}
      >
        {Array.from({ length: remainingGuesses }, (_, i) => (
          <div
            key={i}
            className="bg-primary ring-primary/30 h-3 w-3 rounded-full shadow-lg ring-1 transition-all duration-300"
          />
        ))}
        {remainingGuesses === 0 && <span className="text-muted-foreground text-sm">None</span>}
      </div>
    </div>
  );
};
