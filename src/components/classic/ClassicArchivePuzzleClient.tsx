"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRangeGame } from "@/hooks/useRangeGame";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";
import { GameLayout } from "@/components/GameLayout";
import { LiveAnnouncer } from "@/components/ui/LiveAnnouncer";
import { useVictoryConfetti } from "@/hooks/useVictoryConfetti";
import { useScreenReaderAnnouncements } from "@/hooks/useScreenReaderAnnouncements";
import { formatYear } from "@/lib/displayFormatting";
import { ConfettiRef } from "@/components/magicui/confetti";
import { fetchTotalPuzzles } from "@/lib/puzzleData";
import type { Puzzle } from "@/types/puzzle";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

interface ClassicArchivePuzzleClientProps {
  puzzleNumber: number;
  initialPuzzle: Puzzle;
}

export function ClassicArchivePuzzleClient({
  puzzleNumber,
  initialPuzzle,
}: ClassicArchivePuzzleClientProps) {
  const router = useRouter();
  const confettiRef = useRef<ConfettiRef>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [totalPuzzles, setTotalPuzzles] = useState<number | null>(null);
  const { addToast } = useToast();
  const toast = addToast;

  // Preload total count (used for prev/next bounds)
  useEffect(() => {
    fetchTotalPuzzles()
      .then((count) => setTotalPuzzles(count))
      .catch((err) => logger.error("[ClassicArchive] Failed to fetch total puzzle count", err));
  }, []);

  // Use the game hook with server-provided puzzle to avoid flashes
  const chrondle = useRangeGame(puzzleNumber, initialPuzzle);
  const gameState = chrondle.gameState;

  const isLoading =
    gameState.status === "loading-puzzle" ||
    gameState.status === "loading-auth" ||
    gameState.status === "loading-progress";
  const hasError = gameState.status === "error";
  const targetYear = gameState.status === "ready" ? gameState.puzzle.targetYear : 0;

  useVictoryConfetti(confettiRef, {
    hasWon: gameState.status === "ready" ? gameState.hasWon : false,
    isGameComplete: gameState.status === "ready" ? gameState.isComplete : false,
    isMounted: true,
    guessCount: gameState.status === "ready" ? gameState.ranges.length : 0,
    disabled: false,
  });

  const [screenReaderLastRangeCount, setScreenReaderLastRangeCount] = useState(0);
  const rangeAnnouncement = useScreenReaderAnnouncements({
    ranges: gameState.status === "ready" ? gameState.ranges : [],
    lastRangeCount: screenReaderLastRangeCount,
    setLastRangeCount: setScreenReaderLastRangeCount,
  });

  useEffect(() => {
    if (gameState.status === "ready" && gameState.hasWon && !showSuccess) {
      const lastRange = gameState.ranges.at(-1);
      if (lastRange && lastRange.score > 0) {
        setShowSuccess(true);
        setAnnouncement(`Correct! The year was ${formatYear(targetYear)}`);
      }
    }
  }, [gameState, targetYear, showSuccess]);

  // Show error toast in effect to avoid calling during render
  useEffect(() => {
    if (hasError) {
      toast({
        title: "Failed to load puzzle",
        description: gameState.error,
        variant: "destructive",
      });
    }
  }, [hasError, gameState.error, toast]);

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!totalPuzzles) return;
      const newId = direction === "prev" ? puzzleNumber - 1 : puzzleNumber + 1;
      if (newId < 1 || newId > totalPuzzles) return;
      router.push(`/archive/puzzle/${newId}`);
    },
    [puzzleNumber, totalPuzzles, router],
  );

  if (isLoading || gameState.status !== "ready") {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-secondary text-sm">Loading puzzle…</div>
      </div>
    );
  }

  const liveAnnouncement = announcement || rangeAnnouncement;

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <BackgroundAnimation
        guesses={gameState.guesses}
        targetYear={targetYear}
        isGameOver={gameState.isComplete}
      />
      <GameLayout
        gameState={{
          puzzle: { ...gameState.puzzle, year: gameState.puzzle.targetYear },
          guesses: gameState.guesses,
          ranges: gameState.ranges,
          isGameOver: gameState.isComplete,
          totalScore: gameState.totalScore,
        }}
        isGameComplete={gameState.isComplete}
        hasWon={gameState.hasWon}
        isLoading={isLoading}
        error={null}
        onRangeCommit={chrondle.submitRange}
        remainingAttempts={gameState.remainingAttempts}
        confettiRef={confettiRef}
        isArchive={true}
        headerContent={
          <>
            <AppHeader currentStreak={0} />
            <div className="mx-auto max-w-2xl px-0 py-4">
              <div className="flex items-center justify-between">
                <Link
                  href="/archive"
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ← Back to Archive
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleNavigate("prev")}
                    disabled={totalPuzzles ? puzzleNumber <= 1 : true}
                    className="text-primary/80 hover:text-primary text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleNavigate("next")}
                    disabled={totalPuzzles ? puzzleNumber >= totalPuzzles : true}
                    className="text-primary/80 hover:text-primary text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        }
      />
      <LiveAnnouncer message={liveAnnouncement} />
      <Footer />
    </div>
  );
}
