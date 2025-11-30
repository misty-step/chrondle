"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Loader2Icon, TargetIcon, ClockIcon, UsersIcon, CalendarIcon } from "lucide-react";

/**
 * Today's Puzzles Card - Daily Ops Visibility
 *
 * Shows today's Classic and Order puzzles side by side.
 * At-a-glance view: Is today's content live? How many players so far?
 */
export function TodaysPuzzlesCard() {
  const todaysPuzzles = useQuery(api.admin.puzzles.getTodaysPuzzles);

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-text-primary text-lg font-semibold">
          Today&apos;s Puzzles
        </h2>
        {todaysPuzzles && (
          <span className="text-text-tertiary flex items-center gap-1 text-sm">
            <CalendarIcon className="h-4 w-4" />
            {formatDate(todaysPuzzles.date)}
          </span>
        )}
      </div>

      {!todaysPuzzles ? (
        <div className="text-text-secondary flex items-center gap-2">
          <Loader2Icon className="h-4 w-4 animate-spin" />
          Loading today&apos;s puzzles...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Classic Puzzle */}
          <PuzzleCard
            mode="classic"
            icon={<TargetIcon className="h-5 w-5" />}
            puzzle={
              todaysPuzzles.classic
                ? {
                    puzzleNumber: todaysPuzzles.classic.puzzleNumber,
                    targetDisplay: formatYear(todaysPuzzles.classic.targetYear),
                    eventCount: todaysPuzzles.classic.eventCount,
                    playCount: todaysPuzzles.classic.playCount,
                    hasContext: todaysPuzzles.classic.hasHistoricalContext,
                  }
                : null
            }
          />

          {/* Order Puzzle */}
          <PuzzleCard
            mode="order"
            icon={<ClockIcon className="h-5 w-5" />}
            puzzle={
              todaysPuzzles.order
                ? {
                    puzzleNumber: todaysPuzzles.order.puzzleNumber,
                    targetDisplay: todaysPuzzles.order.eventSpan,
                    eventCount: todaysPuzzles.order.eventCount,
                    playCount: todaysPuzzles.order.playCount,
                    hasContext: false,
                  }
                : null
            }
          />
        </div>
      )}
    </Card>
  );
}

// Individual puzzle card
function PuzzleCard({
  mode,
  icon,
  puzzle,
}: {
  mode: "classic" | "order";
  icon: React.ReactNode;
  puzzle: {
    puzzleNumber: number;
    targetDisplay: string;
    eventCount: number;
    playCount: number;
    hasContext: boolean;
  } | null;
}) {
  const modeLabel = mode === "classic" ? "Classic" : "Order";

  if (!puzzle) {
    return (
      <div className="bg-surface-secondary rounded-lg p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-text-tertiary">{icon}</span>
          <span className="text-text-secondary font-medium">{modeLabel}</span>
        </div>
        <p className="text-text-tertiary text-sm">No puzzle generated yet</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-accent-primary">{icon}</span>
          <span className="text-text-primary font-medium">{modeLabel}</span>
          <Badge variant="default">#{puzzle.puzzleNumber}</Badge>
        </div>
        {puzzle.hasContext && (
          <Badge variant="outline" className="text-xs">
            Has Context
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {/* Target/Span */}
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary text-sm">
            {mode === "classic" ? "Target Year" : "Event Span"}
          </span>
          <span className="text-text-primary font-mono font-medium">{puzzle.targetDisplay}</span>
        </div>

        {/* Event Count */}
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary text-sm">Events</span>
          <span className="text-text-secondary">{puzzle.eventCount}</span>
        </div>

        {/* Play Count */}
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary flex items-center gap-1 text-sm">
            <UsersIcon className="h-3.5 w-3.5" />
            Players
          </span>
          <span className="text-text-primary font-medium">{puzzle.playCount.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// Helper: Format year with BC/AD
function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BC`;
  return `${year} AD`;
}

// Helper: Format date nicely
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
