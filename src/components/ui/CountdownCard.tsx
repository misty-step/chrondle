"use client";

import React from "react";

interface CountdownCardProps {
  timeString: string;
}

export const CountdownCard: React.FC<CountdownCardProps> = ({ timeString }) => {
  return (
    <div className="from-primary/10 dark:from-primary/5 border-primary/20 rounded-sm border bg-gradient-to-br via-blue-50/50 to-purple-50/50 p-4 shadow-lg dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="space-y-2 text-center">
        {/* Header */}
        <div>
          <h3 className="text-foreground mb-1 text-lg font-bold">Next Historical Mystery</h3>
          <p className="text-muted-foreground text-sm">A new puzzle awaits</p>
        </div>

        {/* Countdown */}
        <div className="bg-surface-elevated border-border/30 rounded-sm border p-4">
          <div className="text-primary mb-1 font-mono text-3xl font-bold">{timeString}</div>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Hours : Minutes : Seconds
          </p>
        </div>

        {/* Encouragement */}
        <p className="text-muted-foreground text-xs">Ready for tomorrow&apos;s challenge?</p>
      </div>
    </div>
  );
};
