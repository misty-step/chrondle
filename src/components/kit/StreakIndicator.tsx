"use client";

import React from "react";

interface StreakIndicatorProps {
  current: number;
  longest: number;
  className?: string;
}

export const StreakIndicator: React.FC<StreakIndicatorProps> = ({
  current,
  longest,
  className = "",
}) => {
  // Don't show until player has played at least once
  if (current === 0 && longest === 0) {
    return null;
  }

  const hasActiveStreak = current > 0;
  const streakEmoji = current >= 7 ? "🔥" : current >= 3 ? "⚡" : "📈";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Current Streak */}
      <div
        className="touch-target-min flex items-center gap-1 rounded px-2 py-1 text-sm font-medium transition-all duration-200"
        style={{
          background: hasActiveStreak ? "var(--primary)" : "var(--input)",
          color: hasActiveStreak ? "white" : "var(--foreground)",
          border: hasActiveStreak ? "none" : "1px solid var(--border)",
        }}
        title={`Current streak: ${current} day${current !== 1 ? "s" : ""}`}
        aria-label={`Current streak: ${current} day${current !== 1 ? "s" : ""}`}
      >
        <span className="text-base" aria-hidden="true">
          {streakEmoji}
        </span>
        <span className="font-bold">{current}</span>
      </div>

      {/* Best Streak (if different and exists) */}
      {longest > current && longest > 0 && (
        <div
          className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium"
          style={{
            background: "var(--input)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
          }}
          title={`Best streak: ${longest} day${longest !== 1 ? "s" : ""}`}
          aria-label={`Best streak: ${longest} day${longest !== 1 ? "s" : ""}`}
        >
          <span className="text-base" aria-hidden="true">
            🏆
          </span>
          <span className="font-medium">{longest}</span>
        </div>
      )}
    </div>
  );
};
