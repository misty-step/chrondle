"use client";

import React from "react";
import { formatYear } from "@/lib/displayFormatting";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Check } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface GameTimelineProps {
  events: string[];
  guesses: number[];
  targetYear: number;
  currentHintIndex: number;
  isLoading: boolean;
  error: string | null;
  className?: string;
}

interface CompactTimelineItemProps {
  hintNumber: number;
  hintText: string;
  guess: number;
  targetYear: number;
}

interface ActiveTimelineItemProps {
  hintNumber: number;
  hintText: string | null;
  isLoading: boolean;
}

interface PlaceholderTimelineItemProps {
  hintNumbers: number[];
}

const CompactTimelineItem: React.FC<CompactTimelineItemProps> = ({
  hintNumber,
  hintText,
  guess,
  targetYear,
}) => {
  if (!hintText || guess === undefined || !targetYear) {
    return (
      <Card className="bg-destructive/10 border-destructive/20">
        <CardContent className="p-3">
          <span className="text-destructive font-medium">#{hintNumber}: [DATA MISSING]</span>
        </CardContent>
      </Card>
    );
  }

  const isCorrect = guess === targetYear;
  const isEarlier = guess > targetYear;
  const badgeVariant = isEarlier ? "earlier" : "later";
  const badgeText = isEarlier ? "EARLIER" : "LATER";

  if (isCorrect) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-muted-foreground text-sm font-medium">#{hintNumber}</span>
            <Badge className="bg-green-500 text-white hover:bg-green-600">CORRECT</Badge>
            <span className="text-lg font-bold text-green-700 dark:text-green-300">
              {formatYear(guess)}
            </span>
          </div>
          <p className="pl-8 text-sm text-green-600 dark:text-green-400">{hintText}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-muted-foreground text-sm font-medium">#{hintNumber}</span>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
          <span className="text-lg font-semibold">{formatYear(guess)}</span>
        </div>
        <p className="text-muted-foreground pl-8 text-sm">{hintText}</p>
      </CardContent>
    </Card>
  );
};

const ActiveTimelineItem: React.FC<ActiveTimelineItemProps> = ({
  hintNumber,
  hintText,
  isLoading,
}) => {
  return (
    <Card className="border-primary/20 from-primary/5 to-primary/10 border-2 bg-gradient-to-br shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
            {hintNumber}
          </div>
          <div>
            <span className="text-muted-foreground block text-sm font-medium tracking-wider uppercase">
              🎯 Current Hint
            </span>
            <span className="text-muted-foreground text-xs">Hint {hintNumber} of 6</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <span className="text-muted-foreground text-lg font-medium">Loading hint...</span>
          </div>
        ) : (
          <p className="text-lg leading-relaxed font-medium">{hintText || "No hint available"}</p>
        )}
      </CardContent>
    </Card>
  );
};

const PlaceholderTimelineItem: React.FC<PlaceholderTimelineItemProps> = ({ hintNumbers }) => {
  return (
    <div className="space-y-2">
      {hintNumbers.map((num) => (
        <Card key={num} className="bg-muted/20 border-muted-foreground/30 border-dashed">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
              {num}
            </div>
            <span className="text-muted-foreground text-sm">Hint {num} will be revealed</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const GameTimeline: React.FC<GameTimelineProps> = ({
  events,
  guesses,
  targetYear,
  currentHintIndex,
  isLoading,
  error,
  className = "",
}) => {
  if (error) {
    return (
      <Card className={`${className} border-destructive/50 bg-destructive/5`}>
        <CardContent className="p-6 text-center">
          <div className="mb-3">
            <div className="bg-destructive/20 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <span className="text-destructive text-xl">⚠️</span>
            </div>
            <h3 className="text-destructive mb-2 text-xl font-bold">Unable to Load Puzzle</h3>
            <p className="text-muted-foreground">Please refresh the page to try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Loading puzzle events...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isGameWon = guesses.length > 0 && guesses[guesses.length - 1] === targetYear;

  // Create timeline sections using currentHintIndex as source of truth
  const pastItems: Array<{
    hintNumber: number;
    hintText: string;
    guess: number;
  }> = [];
  const futureHintNumbers: number[] = [];

  // Build past items
  for (let i = 0; i < currentHintIndex; i++) {
    if (guesses[i] !== undefined && events[i] !== undefined) {
      pastItems.push({
        hintNumber: i + 1,
        hintText: events[i],
        guess: guesses[i],
      });
    }
  }

  // Current item
  const currentItem = {
    hintNumber: currentHintIndex + 1,
    hintText: events[currentHintIndex],
  };

  // Build future hint numbers
  if (!isGameWon && currentHintIndex < 5) {
    for (let i = currentHintIndex + 1; i < 6; i++) {
      futureHintNumbers.push(i + 1);
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Timeline Header */}
      <Card className="from-primary/10 to-primary/5 border-primary/20 bg-gradient-to-r">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-foreground text-xl font-bold">Game Progress</h2>
              <p className="text-muted-foreground text-sm">
                {isGameWon ? "Puzzle Complete!" : `${currentHintIndex + 1} of 6 hints revealed`}
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-all duration-300 ${
                    i < currentHintIndex + 1 ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Past Items - Compact */}
      {pastItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
            Previous Guesses
          </h3>
          {pastItems.map((item) => (
            <CompactTimelineItem
              key={`past-${item.hintNumber}`}
              hintNumber={item.hintNumber}
              hintText={item.hintText}
              guess={item.guess}
              targetYear={targetYear}
            />
          ))}
        </div>
      )}

      {/* Current Item - Full Treatment */}
      {!isGameWon && currentHintIndex < 6 && (
        <div>
          <ActiveTimelineItem
            hintNumber={currentItem.hintNumber}
            hintText={currentItem.hintText || "Loading hint..."}
            isLoading={isLoading || !currentItem.hintText}
          />
        </div>
      )}

      {/* Future Items - Minimal Placeholders */}
      {futureHintNumbers.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm font-medium tracking-wider uppercase">
            Upcoming Hints
          </h3>
          <PlaceholderTimelineItem hintNumbers={futureHintNumbers} />
        </div>
      )}

      {/* Game Won State */}
      {isGameWon && (
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950 dark:to-emerald-950">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-2 text-2xl font-bold text-green-700 dark:text-green-300">
              Congratulations!
            </h3>
            <p className="text-lg text-green-600 dark:text-green-400">
              You solved today&apos;s puzzle in {guesses.length} guess
              {guesses.length === 1 ? "" : "es"}!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
