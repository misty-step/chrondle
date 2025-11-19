import React, { useMemo } from "react";
import { Trophy, Calendar, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCORING_CONSTANTS } from "@/lib/scoring";
import { pluralize, pluralizeWord } from "@/lib/displayFormatting";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export interface ScoreDisplayProps {
  width: number;
  hintsUsed: number;
  variant?: "full" | "compact";
  className?: string;
}

export function ScoreDisplay({ width, hintsUsed, variant = "full", className }: ScoreDisplayProps) {
  // Calculate max possible score with flat deduction system
  const maxPossibleScore = useMemo(() => {
    const maxScoreForHints = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS[hintsUsed];
    const widthFactor = (SCORING_CONSTANTS.W_MAX - width + 1) / SCORING_CONSTANTS.W_MAX;
    return Math.max(0, Math.floor(maxScoreForHints * widthFactor));
  }, [width, hintsUsed]);

  const isValid = width <= SCORING_CONSTANTS.W_MAX;

  // Format clues text with proper pluralization
  const cluesText = useMemo(() => {
    if (hintsUsed === 0) return "No clues";
    return pluralize(hintsUsed, "clue");
  }, [hintsUsed]);

  // Format years text with proper pluralization
  const yearsText = useMemo(() => {
    return `${width.toLocaleString()} ${pluralizeWord(width, "year")}`;
  }, [width]);

  // Compact variant: vertical layout for header placement
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 px-5 py-3 shadow-md transition-all sm:px-6 sm:py-4",
          isValid
            ? "border-primary/50 from-primary/10 to-primary/5 shadow-primary/20 bg-gradient-to-br"
            : "border-muted bg-muted/30",
          className,
        )}
      >
        {/* Score - Large and prominent with icon */}
        <div className="flex items-center gap-2">
          <Trophy
            className={cn(
              "h-6 w-6 sm:h-7 sm:w-7",
              isValid ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <AnimatedNumber
            value={maxPossibleScore}
            className={cn(
              "text-3xl font-bold tabular-nums sm:text-4xl",
              isValid ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>

        {/* Context metrics - Separate rows with icons */}
        {isValid ? (
          <div className="flex flex-col items-center gap-1">
            {/* Year range metric */}
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="font-medium">{yearsText}</span>
            </div>
            {/* Clues metric */}
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:text-sm">
              <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="font-medium">{cluesText}</span>
            </div>
          </div>
        ) : (
          <span className="text-destructive text-xs font-medium sm:text-sm">Range too wide</span>
        )}
      </div>
    );
  }

  // Full variant: original vertical card layout
  return (
    <div
      className={cn(
        "rounded-xl border-3 p-8 text-center shadow-lg transition-all",
        isValid
          ? "border-primary/50 from-primary/10 to-primary/5 shadow-primary/20 bg-gradient-to-br"
          : "border-muted bg-muted/30",
        className,
      )}
    >
      <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        Your Score
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <Trophy
          className={cn("h-10 w-10", isValid ? "text-primary" : "text-muted-foreground")}
          aria-hidden="true"
        />
        <AnimatedNumber
          value={maxPossibleScore}
          className={cn(
            "text-5xl font-bold tabular-nums",
            isValid ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="mt-4 flex flex-col items-center gap-2">
        {isValid ? (
          <>
            {/* Year range metric */}
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{yearsText} range</span>
            </div>
            {/* Clues metric */}
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{cluesText}</span>
            </div>
          </>
        ) : (
          <span className="text-destructive font-medium">
            Range too wide (max {pluralize(SCORING_CONSTANTS.W_MAX, "year")})
          </span>
        )}
      </div>
    </div>
  );
}
