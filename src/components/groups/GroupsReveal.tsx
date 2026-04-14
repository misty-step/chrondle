"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import type { CompletedState, GroupsTier } from "@/types/groupsGameState";

interface GroupsRevealProps {
  gameState: CompletedState;
  onShare: () => Promise<void>;
}

export function GroupsReveal({ gameState, onShare }: GroupsRevealProps) {
  const boardText = new Map(gameState.puzzle.board.map((card) => [card.id, card.text]));

  return (
    <Card className="gap-6">
      <CardHeader className="gap-2 text-center">
        <CardTitle>
          {gameState.hasWon ? "You Found All Four Years" : "The Board Is Revealed"}
        </CardTitle>
        <CardDescription>
          {gameState.hasWon
            ? `${gameState.mistakes} mistakes, ${gameState.submissions.length} total submissions.`
            : "Four mistakes ends the round. Here are the hidden year-groups."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {gameState.revealedGroups.map((group) => (
            <div
              key={group.id}
              className="border-groups-accent/20 bg-groups-accent/8 rounded-2xl border p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                    Revealed Year
                  </p>
                  <h3 className="text-lg font-semibold">{formatYear(group.year)}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.12em] uppercase ${tierTone(group.tier)}`}
                >
                  {group.tier}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {group.eventIds.map((eventId) => (
                  <div
                    key={eventId}
                    className="border-groups-accent/15 bg-background rounded-xl border px-3 py-2 text-sm leading-snug"
                  >
                    {boardText.get(eventId) ?? eventId}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            className="bg-groups-accent hover:bg-groups-accent/90 text-white"
            onClick={() => void onShare()}
          >
            Share Result
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
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
