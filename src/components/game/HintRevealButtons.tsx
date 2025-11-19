import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SCORING_CONSTANTS } from "@/lib/scoring";

interface HintRevealButtonsProps {
  events: string[];
  hintsRevealed: number; // 0-5 (0 = first event only, 5 = all 6 events revealed)
  onRevealHint: (hintIndex: number) => void;
  disabled?: boolean;
  className?: string;
}

function getHintCost(hintsRevealed: number): number {
  // Return flat cost for the next hint (hintsRevealed is 0-5, cost is for next hint)
  if (hintsRevealed >= SCORING_CONSTANTS.HINT_COSTS.length) {
    return 0; // No more hints available
  }
  return SCORING_CONSTANTS.HINT_COSTS[hintsRevealed];
}

function ClueProgressDots({ total, revealed }: { total: number; revealed: number }) {
  return (
    <div className="flex items-center justify-start gap-2">
      <span className="text-muted-foreground text-xs font-semibold">Clues:</span>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-3 w-3 rounded-full transition-all",
            index < revealed ? "bg-primary shadow-sm" : "bg-muted-foreground/30",
          )}
        />
      ))}
      <span className="text-muted-foreground text-xs font-semibold">
        {revealed}/{total}
      </span>
    </div>
  );
}

export function HintRevealButtons({
  events,
  hintsRevealed,
  onRevealHint,
  disabled = false,
  className,
}: HintRevealButtonsProps) {
  const totalClues = events.length;
  const hasMoreClues = hintsRevealed < totalClues - 1;

  // First event is always shown (the puzzle itself)
  const firstEvent = events[0];

  // Additional revealed clues
  const revealedClues = events.slice(1, hintsRevealed + 1);

  // Get flat cost for next clue
  const hintCost = getHintCost(hintsRevealed);

  return (
    <div className={cn("space-y-5", className)}>
      {/* The Puzzle Event - Hero Display */}
      <div className="border-primary bg-primary/10 rounded-xl border-2 p-5 shadow-md sm:p-6">
        <div className="text-primary mb-2 text-xs font-bold tracking-wider uppercase">
          The Event
        </div>
        <div className="text-foreground text-base leading-relaxed sm:text-lg">{firstEvent}</div>
      </div>

      {/* Additional Revealed Clues */}
      {revealedClues.length > 0 && (
        <div className="space-y-3">
          {revealedClues.map((clue, index) => (
            <div
              key={index}
              className="border-primary/40 bg-primary/5 rounded-lg border p-4 shadow-sm"
            >
              <div className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
                Clue {index + 2}
              </div>
              <div className="text-sm">{clue}</div>
            </div>
          ))}
        </div>
      )}

      {/* Clue Reveal Section - Only if more clues available */}
      {hasMoreClues && (
        <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-semibold">Want Another Clue?</span>
            <ClueProgressDots total={totalClues} revealed={hintsRevealed + 1} />
          </div>

          <p className="text-muted-foreground mb-4 text-sm">
            Revealing clue #{hintsRevealed + 2} costs{" "}
            <span className="text-base font-bold text-amber-600 dark:text-amber-500">
              {hintCost} points
            </span>
          </p>

          <Button
            variant="outline"
            size="lg"
            onClick={() => onRevealHint(hintsRevealed)}
            disabled={disabled}
            className="h-12 w-full border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-amber-500/10 text-base font-semibold transition-all hover:scale-[1.02] hover:border-amber-500/70 hover:bg-amber-500/15 hover:shadow-md"
          >
            Reveal Clue
          </Button>
        </div>
      )}
    </div>
  );
}
