"use client";

import { Info } from "lucide-react";
import { SmartTooltip } from "@/components/ui/SmartTooltip";
import type { OrderScore } from "@/types/orderGameState";

interface ScoreTooltipProps {
  score: OrderScore;
}

export function ScoreTooltip({ score }: ScoreTooltipProps) {
  const accuracyPercent = Math.round((score.correctPairs / score.totalPairs) * 100);
  const totalEvents = 6; // Standard puzzle size

  const perfectPositionsTooltip = `Events placed in the exact correct position. This is the most intuitive metric for your performance.`;
  const accuracyTooltip = `Percentage of chronological pairs in correct order. Measures overall timeline accuracy.`;
  const chronologicalPairsTooltip = `Counts all pairwise relationships. With ${totalEvents} events, there are ${score.totalPairs} possible pairs. Each correctly ordered pair earns a point.`;

  return (
    <div className="space-y-3">
      {/* Perfect Positions - Primary Metric */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-sm font-medium">Perfect Positions</span>
          <SmartTooltip content={perfectPositionsTooltip} side="bottom">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Explain Perfect Positions"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </SmartTooltip>
        </div>
        <span className="text-foreground text-2xl font-bold">
          {score.perfectPositions ?? 0}/{totalEvents}
        </span>
      </div>

      {/* Accuracy - Secondary */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/80">Accuracy</span>
          <SmartTooltip content={accuracyTooltip} side="bottom">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Explain Accuracy"
            >
              <Info className="h-3 w-3" />
            </button>
          </SmartTooltip>
        </div>
        <span className="text-foreground font-medium">{accuracyPercent}%</span>
      </div>

      {/* Pairs Detail - Secondary */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground/80">Chronological Pairs</span>
          <SmartTooltip content={chronologicalPairsTooltip} side="bottom">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Explain Chronological Pairs"
            >
              <Info className="h-3 w-3" />
            </button>
          </SmartTooltip>
        </div>
        <span className="text-foreground font-medium">
          {score.correctPairs}/{score.totalPairs}
        </span>
      </div>

      {/* Hints Used */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/80">Hints Used</span>
        <span className="text-foreground font-medium">{score.hintsUsed}/3</span>
      </div>
    </div>
  );
}
