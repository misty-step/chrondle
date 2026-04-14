"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { GROUPS_SELECTION_SIZE, MAX_GROUPS_MISTAKES } from "@/lib/groups/engine";
import { cn } from "@/lib/utils";
import type { GroupsRevealedGroup, GroupsTier, ReadyState } from "@/types/groupsGameState";

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
  const totalGroups = gameState.puzzle.groups.length;
  const selectedCards = gameState.selectedIds
    .map((eventId) => {
      const text = boardText.get(eventId);
      return text ? { id: eventId, text } : null;
    })
    .filter((card): card is { id: string; text: string } => card !== null);
  const recentAttempts = gameState.submissions.slice(-4).reverse();

  return (
    <Card className="gap-5 overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Find The Four Hidden Years</CardTitle>
            <CardDescription>
              Build exact sets of four matching events. Three of four returns One away.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill label={`${gameState.revealedGroups.length}/${totalGroups} solved`} />
            <StatusPill
              label={`${gameState.selectedIds.length}/${GROUPS_SELECTION_SIZE} selected`}
            />
          </div>
        </div>

        <div className="border-groups-accent/15 bg-groups-accent/8 grid gap-3 rounded-2xl border px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                Mistakes Remaining
              </p>
              <MistakeMeter remainingMistakes={gameState.remainingMistakes} />
            </div>
            <p className="text-muted-foreground max-w-xl text-sm">
              Solved rows lock into place at the top of the board, just like Connections.
            </p>
          </div>
          <p className="text-muted-foreground text-xs md:text-right">
            Shuffle to re-stack the unsolved cards without changing the solution.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {lastError ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
            {lastError}
          </div>
        ) : null}

        <div
          aria-label="Groups board"
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
          role="group"
        >
          {gameState.revealedGroups.map((group) => (
            <RevealedGroupRow key={group.id} group={group} boardText={boardText} />
          ))}

          {gameState.activeCards.map((card) => {
            const isSelected = gameState.selectedIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleSelection(card.id)}
                title={card.text}
                className={cn(
                  "group relative flex min-h-[6.5rem] items-center justify-center overflow-hidden rounded-2xl border px-2.5 py-3 text-center shadow-sm transition-all duration-150",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  "sm:aspect-square sm:min-h-0",
                  isSelected
                    ? "border-groups-accent bg-groups-accent text-white shadow-md"
                    : "border-border bg-surface-elevated hover:border-groups-accent/35 hover:bg-surface-inset",
                )}
              >
                <span
                  className={cn(
                    "line-clamp-5 text-[11px] leading-[1.15] font-semibold text-balance sm:text-xs lg:text-[13px]",
                    isSelected ? "text-white" : "text-foreground",
                  )}
                >
                  {card.text}
                </span>
              </button>
            );
          })}
        </div>

        <SelectionTray selectedCards={selectedCards} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="sm:flex-1" onClick={shuffleBoard}>
            Shuffle
          </Button>
          <Button variant="outline" className="sm:flex-1" onClick={clearSelection}>
            Deselect All
          </Button>
          <Button
            className="bg-groups-accent hover:bg-groups-accent/90 text-white sm:flex-[1.25]"
            disabled={gameState.selectedIds.length !== GROUPS_SELECTION_SIZE || isSubmitting}
            onClick={() => void submitSelection()}
          >
            {isSubmitting ? "Submitting..." : "Submit Group"}
          </Button>
        </div>

        <details className="border-border bg-surface-subtle rounded-2xl border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
            Recent Attempts
            <span className="text-muted-foreground text-xs font-medium">
              {gameState.submissions.length === 0
                ? "No guesses yet"
                : `${Math.min(gameState.submissions.length, recentAttempts.length)} shown`}
            </span>
          </summary>
          <div className="space-y-2 border-t px-4 py-3">
            {recentAttempts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No guesses yet.</p>
            ) : (
              recentAttempts.map((submission, index) => (
                <div key={`${submission.timestamp}-${index}`} className="rounded-xl border p-3">
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
                  <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                    {submission.eventIds.map((id) => boardText.get(id) ?? id).join(" · ")}
                  </p>
                </div>
              ))
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function SelectionTray({ selectedCards }: { selectedCards: Array<{ id: string; text: string }> }) {
  const slots = Array.from(
    { length: GROUPS_SELECTION_SIZE },
    (_, index) => selectedCards[index] ?? null,
  );

  return (
    <section
      aria-label="Current selection"
      className="border-groups-accent/15 bg-background rounded-2xl border p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Current Selection</p>
          <p className="text-muted-foreground text-sm">
            Full event text lives here so the board can stay compact.
          </p>
        </div>
        <span className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {selectedCards.length}/{GROUPS_SELECTION_SIZE}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {slots.map((card, index) =>
          card ? (
            <div
              key={card.id}
              className="border-groups-accent/20 bg-groups-accent/8 rounded-xl border px-3 py-3"
            >
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
                Slot {index + 1}
              </p>
              <p className="text-sm leading-relaxed">{card.text}</p>
            </div>
          ) : (
            <div
              key={`empty-slot-${index}`}
              className="border-border bg-surface-subtle text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-sm"
            >
              Empty slot
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function RevealedGroupRow({
  group,
  boardText,
}: {
  group: GroupsRevealedGroup;
  boardText: Map<string, string>;
}) {
  return (
    <div
      className={cn(
        "col-span-full grid gap-3 rounded-2xl border px-4 py-4 shadow-sm",
        revealedRowTone(group.tier),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">
            Solved Group
          </p>
          <p className="text-lg font-semibold">{formatYear(group.year)}</p>
        </div>
        <span className="rounded-full bg-black/10 px-2.5 py-1 text-xs font-semibold tracking-[0.12em] text-current uppercase">
          {group.tier}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {group.eventIds.map((eventId) => (
          <div
            key={eventId}
            className="rounded-xl bg-white/70 px-3 py-2 text-sm leading-snug text-current shadow-sm ring-1 ring-black/5 dark:bg-black/20"
          >
            {boardText.get(eventId) ?? eventId}
          </div>
        ))}
      </div>
    </div>
  );
}

function MistakeMeter({ remainingMistakes }: { remainingMistakes: number }) {
  return (
    <div className="mt-2 flex items-center gap-2" aria-label={`${remainingMistakes} mistakes left`}>
      {Array.from({ length: MAX_GROUPS_MISTAKES }, (_, index) => {
        const active = index < remainingMistakes;
        return (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              "h-2.5 w-8 rounded-full transition-colors",
              active ? "bg-groups-accent" : "bg-groups-accent/20",
            )}
          />
        );
      })}
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="border-border bg-background rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase">
      {label}
    </span>
  );
}

function revealedRowTone(tier: GroupsTier): string {
  switch (tier) {
    case "easy":
      return "border-emerald-300/60 bg-emerald-100/95 text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-100";
    case "medium":
      return "border-amber-300/60 bg-amber-100/95 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-100";
    case "hard":
      return "border-sky-300/60 bg-sky-100/95 text-sky-950 dark:border-sky-700/60 dark:bg-sky-950/50 dark:text-sky-100";
    case "very hard":
      return "border-violet-300/60 bg-violet-100/95 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-100";
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
