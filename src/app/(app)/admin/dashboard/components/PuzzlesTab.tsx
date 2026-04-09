"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CircleNotch, Target, Clock, Users } from "@phosphor-icons/react";
import { anyPublicApi } from "@/lib/convexAnyApi";
import { cn } from "@/lib/utils";
import { PuzzleDetailModal } from "./PuzzleDetailModal";

type PuzzleMode = "classic" | "order" | "groups";

interface ClassicPuzzleItem {
  _id: Id<"puzzles">;
  puzzleNumber: number;
  date: string;
  targetYear: number;
  eventCount: number;
  playCount: number;
  avgScore: number;
  hasHistoricalContext: boolean;
  status: "active" | "completed" | "future";
}

interface OrderPuzzleItem {
  _id: Id<"orderPuzzles">;
  puzzleNumber: number;
  date: string;
  eventSpan: string;
  eventCount: number;
  playCount: number;
  avgScore: null;
  status: "active" | "completed" | "future";
}

interface GroupsPuzzleItem {
  _id: Id<"groupsPuzzles">;
  puzzleNumber: number;
  date: string;
  yearSpan: string;
  eventCount: number;
  groupCount: number;
  playCount: number;
  avgScore: null;
  status: "active" | "completed" | "future";
}

type PuzzleItem = ClassicPuzzleItem | OrderPuzzleItem | GroupsPuzzleItem;

/**
 * Puzzles Manager Tab - Browse and inspect puzzles
 *
 * Features:
 * - Mode toggle (Classic/Order/Groups)
 * - Puzzle list with key metrics
 * - Click to view detailed puzzle modal
 */
export default function PuzzlesTab() {
  const [mode, setMode] = useState<PuzzleMode>("classic");
  const [selectedPuzzleNumber, setSelectedPuzzleNumber] = useState<number | null>(null);

  // Query puzzles for current mode
  const puzzlesResult = useQuery(anyPublicApi.admin.puzzles.listPuzzles, {
    mode,
    limit: 50,
  });

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center gap-4">
        <ModeToggle mode={mode} onChange={setMode} />
        {puzzlesResult && (
          <span className="text-text-tertiary text-sm">{puzzlesResult.totalCount} puzzles</span>
        )}
      </div>

      {/* Puzzles Table */}
      <Card className="p-6">
        {!puzzlesResult ? (
          <div className="text-text-secondary flex items-center gap-2">
            <CircleNotch className="h-4 w-4 animate-spin" />
            Loading puzzles...
          </div>
        ) : puzzlesResult.puzzles.length === 0 ? (
          <div className="text-text-secondary py-8 text-center">No {mode} puzzles found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-surface-secondary border-b text-left">
                  <th className="text-text-secondary w-16 pb-2 font-medium">#</th>
                  <th className="text-text-secondary pb-2 font-medium">Date</th>
                  <th className="text-text-secondary pb-2 font-medium">
                    {mode === "classic"
                      ? "Target Year"
                      : mode === "order"
                        ? "Event Span"
                        : "Year Span"}
                  </th>
                  <th className="text-text-secondary w-24 pb-2 font-medium">Plays</th>
                  {mode === "classic" && (
                    <th className="text-text-secondary w-28 pb-2 font-medium">Avg Guesses</th>
                  )}
                  <th className="text-text-secondary w-24 pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {puzzlesResult.puzzles.map((puzzle: PuzzleItem) => (
                  <tr
                    key={puzzle._id}
                    className="border-surface-secondary hover:bg-surface-secondary cursor-pointer border-b transition-colors"
                    onClick={() => setSelectedPuzzleNumber(puzzle.puzzleNumber)}
                  >
                    <td className="text-text-primary py-3 font-mono font-medium">
                      {puzzle.puzzleNumber}
                    </td>
                    <td className="text-text-secondary py-3">{formatDate(puzzle.date)}</td>
                    <td className="text-text-primary py-3 font-mono">
                      {mode === "classic"
                        ? formatYear((puzzle as ClassicPuzzleItem).targetYear)
                        : mode === "order"
                          ? (puzzle as OrderPuzzleItem).eventSpan
                          : (puzzle as GroupsPuzzleItem).yearSpan}
                    </td>
                    <td className="text-text-secondary py-3">
                      {puzzle.playCount.toLocaleString()}
                    </td>
                    {mode === "classic" && (
                      <td className="text-text-secondary py-3">
                        {(puzzle as ClassicPuzzleItem).avgScore.toFixed(1)}
                      </td>
                    )}
                    <td className="py-3">
                      <StatusBadge status={puzzle.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Info */}
        {puzzlesResult && puzzlesResult.puzzles.length > 0 && (
          <div className="text-text-secondary mt-4 text-xs">
            Showing {puzzlesResult.puzzles.length} of {puzzlesResult.totalCount} puzzles
          </div>
        )}
      </Card>

      {/* Puzzle Detail Modal */}
      <PuzzleDetailModal
        mode={mode}
        puzzleNumber={selectedPuzzleNumber}
        onClose={() => setSelectedPuzzleNumber(null)}
      />
    </div>
  );
}

// Mode toggle component
function ModeToggle({
  mode,
  onChange,
}: {
  mode: PuzzleMode;
  onChange: (mode: PuzzleMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Puzzle mode"
      className="bg-surface-secondary inline-flex rounded-lg p-1"
    >
      <button
        role="radio"
        aria-checked={mode === "classic"}
        onClick={() => onChange("classic")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          "focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          mode === "classic"
            ? "bg-surface-primary text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary",
        )}
      >
        <Target className="mr-1.5 inline h-4 w-4" />
        Classic
      </button>
      <button
        role="radio"
        aria-checked={mode === "order"}
        onClick={() => onChange("order")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          "focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          mode === "order"
            ? "bg-surface-primary text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary",
        )}
      >
        <Clock className="mr-1.5 inline h-4 w-4" />
        Order
      </button>
      <button
        role="radio"
        aria-checked={mode === "groups"}
        onClick={() => onChange("groups")}
        className={cn(
          "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
          "focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          mode === "groups"
            ? "bg-surface-primary text-text-primary shadow-sm"
            : "text-text-secondary hover:text-text-primary",
        )}
      >
        <Users className="mr-1.5 inline h-4 w-4" />
        Groups
      </button>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: "active" | "completed" | "future" }) {
  const variants = {
    active: { variant: "default" as const, label: "Active" },
    completed: { variant: "outline" as const, label: "Completed" },
    future: { variant: "secondary" as const, label: "Future" },
  };

  const { variant, label } = variants[status];
  return <Badge variant={variant}>{label}</Badge>;
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
