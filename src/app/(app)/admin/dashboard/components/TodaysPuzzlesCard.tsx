"use client";

import React from "react";
import { useQuery } from "convex/react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CircleNotch, Target, Clock, Users, Calendar } from "@phosphor-icons/react";
import { anyPublicApi } from "@/lib/convexAnyApi";

/**
 * Today's Puzzles Card - Daily Ops Visibility
 *
 * Shows today's Classic, Order, and Groups puzzles side by side.
 * At-a-glance view: Is today's content live? How many players so far?
 */
export function TodaysPuzzlesCard() {
  const todaysPuzzles = useQuery(anyPublicApi.admin.puzzles.getTodaysPuzzles) as
    | {
        date: string;
        classic: {
          puzzleNumber: number;
          targetYear: number;
          eventCount: number;
          playCount: number;
          hasHistoricalContext: boolean;
        } | null;
        order: {
          puzzleNumber: number;
          eventSpan: string;
          eventCount: number;
          playCount: number;
        } | null;
        groups: {
          puzzleNumber: number;
          yearSpan: string;
          eventCount: number;
          groupCount: number;
          playCount: number;
        } | null;
      }
    | undefined;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-text-primary text-lg font-semibold">
          Today&apos;s Puzzles
        </h2>
        {todaysPuzzles && (
          <span className="text-text-tertiary flex items-center gap-1 text-sm">
            <Calendar className="h-4 w-4" />
            {formatDate(todaysPuzzles.date)}
          </span>
        )}
      </div>

      {!todaysPuzzles ? (
        <div className="text-text-secondary flex items-center gap-2">
          <CircleNotch className="h-4 w-4 animate-spin" />
          Loading today&apos;s puzzles...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Classic Puzzle */}
          <PuzzleCard
            mode="classic"
            icon={<Target className="h-5 w-5" />}
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
            icon={<Clock className="h-5 w-5" />}
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

          {/* Groups Puzzle */}
          <PuzzleCard
            mode="groups"
            icon={<Users className="h-5 w-5" />}
            puzzle={
              todaysPuzzles.groups
                ? {
                    puzzleNumber: todaysPuzzles.groups.puzzleNumber,
                    targetDisplay: todaysPuzzles.groups.yearSpan,
                    eventCount: todaysPuzzles.groups.eventCount,
                    groupCount: todaysPuzzles.groups.groupCount,
                    playCount: todaysPuzzles.groups.playCount,
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
  mode: "classic" | "order" | "groups";
  icon: React.ReactNode;
  puzzle: {
    puzzleNumber: number;
    targetDisplay: string;
    eventCount: number;
    groupCount?: number;
    playCount: number;
    hasContext: boolean;
  } | null;
}) {
  const modeLabel = mode === "classic" ? "Classic" : mode === "order" ? "Order" : "Groups";

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
            {mode === "classic" ? "Target Year" : mode === "order" ? "Event Span" : "Year Span"}
          </span>
          <span className="text-text-primary font-mono font-medium">{puzzle.targetDisplay}</span>
        </div>

        {/* Event Count */}
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary text-sm">Events</span>
          <span className="text-text-secondary">{puzzle.eventCount}</span>
        </div>

        {/* Group Count (Groups mode only) */}
        {mode === "groups" && (
          <div className="flex items-center justify-between">
            <span className="text-text-tertiary text-sm">Groups</span>
            <span className="text-text-secondary">{puzzle.groupCount ?? 0}</span>
          </div>
        )}

        {/* Play Count */}
        <div className="flex items-center justify-between">
          <span className="text-text-tertiary flex items-center gap-1 text-sm">
            <Users className="h-3.5 w-3.5" />
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
