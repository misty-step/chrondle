"use client";

import React from "react";

interface CountdownCardProps {
  timeString: string;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({ timeString }) => {
  return (
    <div className="border-border border-t py-5 text-center">
      <h3 className="text-foreground text-lg font-semibold">Next puzzle in</h3>
      <p
        role="timer"
        aria-label="Time until the next puzzle"
        className="text-foreground mt-2 font-mono text-3xl font-semibold tabular-nums sm:text-4xl"
      >
        {timeString}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">Hours : minutes : seconds</p>
    </div>
  );
};
