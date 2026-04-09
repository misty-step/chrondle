"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReadyState, GroupsRevealedGroup, GroupsTier } from "@/types/groupsGameState";

interface GroupsBoardProps {
  gameState: ReadyState;
  toggleSelection: (eventId: string) => void;
  clearSelection: () => void;
  shuffleBoard: () => void;
  submitSelection: () => Promise<void>;
  isSubmitting: boolean;
  lastError: string | null;
}

export function GroupsBoard({
  gameState,
  toggleSelection,
  clearSelection,
  shuffleBoard,
  submitSelection,
  isSubmitting,
  lastError,
}: GroupsBoardProps) {
  const boardText = new Map(gameState.puzzle.board.map((card) => [card.id, card.text]));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="gap-4">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Find The Four Hidden Years</CardTitle>
              <CardDescription>
                Select four unsolved events at a time. Four mistakes ends the puzzle.
              </CardDescription>
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-sm">
              <span>{gameState.revealedGroups.length}/4 solved</span>
              <span>{gameState.remainingMistakes} mistakes left</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gameState.revealedGroups.length > 0 && (
            <div className="space-y-3">
              {gameState.revealedGroups.map((group) => (
                <RevealedGroupCard key={group.id} group={group} boardText={boardText} />
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gameState.activeCards.map((card) => {
              const isSelected = gameState.selectedIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleSelection(card.id)}
                  className={cn(
                    "min-h-28 rounded-lg border p-3 text-left text-sm transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    isSelected
                      ? "border-groups-accent bg-groups-accent/10 text-foreground"
                      : "border-border bg-surface-elevated hover:bg-surface-inset",
                  )}
                >
                  <span className="line-clamp-4 font-medium">{card.text}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit gap-4">
        <CardHeader className="gap-2">
          <CardTitle>Control Panel</CardTitle>
          <CardDescription>Exact groups solve. Three of four returns One away.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-groups-accent/8 border-groups-accent/20 rounded-lg border p-4">
            <p className="text-sm font-semibold">{gameState.selectedIds.length} of 4 selected</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick four cards, then submit the set for evaluation.
            </p>
          </div>

          {lastError && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
              {lastError}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={clearSelection}>
              Clear
            </Button>
            <Button variant="outline" className="flex-1" onClick={shuffleBoard}>
              Shuffle
            </Button>
          </div>

          <Button
            className="bg-groups-accent hover:bg-groups-accent/90 w-full text-white"
            disabled={gameState.selectedIds.length !== 4 || isSubmitting}
            onClick={() => void submitSelection()}
          >
            {isSubmitting ? "Submitting..." : "Submit Group"}
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Recent Attempts</p>
            <div className="space-y-2">
              {gameState.submissions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No guesses yet.</p>
              ) : (
                gameState.submissions
                  .slice(-6)
                  .reverse()
                  .map((submission, index) => (
                    <div
                      key={`${submission.timestamp}-${index}`}
                      className="bg-surface-inset rounded-lg border p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-xs font-semibold tracking-[0.12em] uppercase",
                            resultTone(submission.result),
                          )}
                        >
                          {submission.result === "one_away" ? "One away" : submission.result}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatAttemptTime(submission.timestamp)}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {submission.eventIds.map((id) => boardText.get(id) ?? id).join(" · ")}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RevealedGroupCard({
  group,
  boardText,
}: {
  group: GroupsRevealedGroup;
  boardText: Map<string, string>;
}) {
  return (
    <div className="bg-groups-accent/8 border-groups-accent/20 rounded-lg border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold">{formatYear(group.year)}</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.12em] uppercase",
            tierTone(group.tier),
          )}
        >
          {group.tier}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {group.eventIds.map((eventId) => (
          <div
            key={eventId}
            className="border-groups-accent/15 bg-background rounded-md border px-3 py-2 text-sm"
          >
            {boardText.get(eventId) ?? eventId}
          </div>
        ))}
      </div>
    </div>
  );
}

function tierTone(tier: GroupsTier): string {
  switch (tier) {
    case "easy":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "medium":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "hard":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200";
    case "very hard":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
  }
}

function resultTone(result: string): string {
  switch (result) {
    case "solved":
      return "text-emerald-700 dark:text-emerald-300";
    case "one_away":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-rose-700 dark:text-rose-300";
  }
}

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
}

function formatAttemptTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
