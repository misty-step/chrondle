"use client";

import { cn } from "@/lib/utils";

/**
 * Loading skeleton for the game, shown while puzzle data loads.
 * Matches the visual structure of GameLayout for seamless transition.
 */
export function GameSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      {/* Event card skeleton */}
      <div className="w-full max-w-md">
        <div
          className={cn("bg-card border-outline-default/50 rounded-lg border p-6", "animate-pulse")}
        >
          {/* Hint number badge */}
          <div className="mb-4 flex items-center gap-2">
            <div className="bg-muted h-6 w-16 rounded" />
          </div>
          {/* Event text placeholder */}
          <div className="space-y-2">
            <div className="bg-muted h-4 w-full rounded" />
            <div className="bg-muted h-4 w-3/4 rounded" />
          </div>
        </div>
      </div>

      {/* Range input skeleton */}
      <div className="w-full max-w-md">
        <div className="bg-card border-outline-default/50 animate-pulse rounded-lg border p-4">
          <div className="flex items-center justify-center gap-4">
            <div className="bg-muted h-10 w-24 rounded" />
            <div className="bg-muted h-4 w-8 rounded" />
            <div className="bg-muted h-10 w-24 rounded" />
          </div>
          <div className="bg-muted mt-4 h-10 w-full rounded" />
        </div>
      </div>

      {/* Hint indicator skeleton */}
      <div className="flex gap-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-muted h-2 w-2 animate-pulse rounded-full" />
        ))}
      </div>
    </div>
  );
}
