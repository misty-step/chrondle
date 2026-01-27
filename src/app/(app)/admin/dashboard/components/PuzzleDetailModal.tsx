"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/Badge";
import { Loader2Icon, UsersIcon, TargetIcon, CheckCircleIcon, BookOpenIcon } from "lucide-react";

type PuzzleMode = "classic" | "order";

interface PuzzleDetailModalProps {
  mode: PuzzleMode;
  puzzleNumber: number | null;
  onClose: () => void;
}

/**
 * Puzzle Detail Modal - Full puzzle information
 *
 * Shows:
 * - Puzzle metadata (number, date, status)
 * - Events list (mode-specific)
 * - Player statistics
 * - Historical context (Classic only)
 */
export function PuzzleDetailModal({ mode, puzzleNumber, onClose }: PuzzleDetailModalProps) {
  const isOpen = puzzleNumber !== null;

  // Query puzzle detail when modal is open
  const puzzleDetail = useQuery(
    api.admin.puzzles.getPuzzleDetail,
    isOpen ? { mode, puzzleNumber: puzzleNumber! } : "skip",
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {!puzzleDetail ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="text-text-secondary h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono">Puzzle #{puzzleDetail.puzzleNumber}</span>
                <StatusBadge status={puzzleDetail.status} />
              </DialogTitle>
              <DialogDescription>{formatDate(puzzleDetail.date)}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {mode === "classic" &&
                  "targetYear" in puzzleDetail &&
                  puzzleDetail.targetYear !== undefined && (
                    <StatCard
                      icon={<TargetIcon className="h-4 w-4" />}
                      label="Target Year"
                      value={formatYear(puzzleDetail.targetYear)}
                    />
                  )}
                {mode === "order" &&
                  "eventSpan" in puzzleDetail &&
                  puzzleDetail.eventSpan !== undefined && (
                    <StatCard
                      icon={<TargetIcon className="h-4 w-4" />}
                      label="Event Span"
                      value={`${formatYear(puzzleDetail.eventSpan.min)} – ${formatYear(puzzleDetail.eventSpan.max)}`}
                    />
                  )}
                <StatCard
                  icon={<UsersIcon className="h-4 w-4" />}
                  label="Players"
                  value={puzzleDetail.playCount.toLocaleString()}
                />
                <StatCard
                  icon={<CheckCircleIcon className="h-4 w-4" />}
                  label="Completion Rate"
                  value={`${puzzleDetail.completionRate}%`}
                />
                {mode === "classic" &&
                  "avgGuesses" in puzzleDetail &&
                  puzzleDetail.avgGuesses !== undefined && (
                    <StatCard
                      icon={<TargetIcon className="h-4 w-4" />}
                      label="Avg Guesses"
                      value={puzzleDetail.avgGuesses.toFixed(1)}
                    />
                  )}
              </div>

              {/* Events List */}
              <div>
                <h3 className="text-text-primary mb-3 text-sm font-medium">
                  Events ({puzzleDetail.events.length})
                </h3>
                <div className="bg-surface-secondary space-y-2 rounded-lg p-3">
                  {mode === "classic" && Array.isArray(puzzleDetail.events)
                    ? // Classic mode: events are strings
                      (puzzleDetail.events as string[]).map((event, index) => (
                        <div
                          key={index}
                          className="text-text-secondary flex items-start gap-2 text-sm"
                        >
                          <span className="text-text-tertiary mt-0.5 font-mono text-xs">
                            {index + 1}.
                          </span>
                          <span>{event}</span>
                        </div>
                      ))
                    : mode === "order" && "events" in puzzleDetail
                      ? // Order mode: events have year and text
                        (
                          puzzleDetail.events as Array<{
                            id: string;
                            year: number;
                            text: string;
                          }>
                        ).map((event) => (
                          <div
                            key={event.id}
                            className="text-text-secondary flex items-start gap-2 text-sm"
                          >
                            <span className="text-text-tertiary shrink-0 font-mono text-xs">
                              {formatYear(event.year)}
                            </span>
                            <span>{event.text}</span>
                          </div>
                        ))
                      : null}
                </div>
              </div>

              {/* Historical Context (Classic only) */}
              {mode === "classic" &&
                "historicalContext" in puzzleDetail &&
                puzzleDetail.historicalContext && (
                  <div>
                    <h3 className="text-text-primary mb-3 flex items-center gap-2 text-sm font-medium">
                      <BookOpenIcon className="h-4 w-4" />
                      Historical Context
                    </h3>
                    <div className="bg-surface-secondary text-text-secondary rounded-lg p-3 text-sm">
                      <p className="line-clamp-6 whitespace-pre-wrap">
                        {puzzleDetail.historicalContext}
                      </p>
                      {puzzleDetail.historicalContext.length > 500 && (
                        <p className="text-text-tertiary mt-2 text-xs">
                          Showing preview... ({puzzleDetail.historicalContext.length} chars)
                        </p>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Stat card component
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface-secondary rounded-lg p-3">
      <div className="text-text-tertiary mb-1 flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <div className="text-text-primary font-mono text-lg font-semibold">{value}</div>
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
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
