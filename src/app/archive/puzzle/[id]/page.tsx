"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { fetchTotalPuzzles } from "@/lib/puzzleData";
import { useRangeGame } from "@/hooks/useRangeGame";
import { isReady } from "@/types/gameState";
import { GameLayout } from "@/components/GameLayout";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LiveAnnouncer } from "@/components/ui/LiveAnnouncer";
import { useVictoryConfetti } from "@/hooks/useVictoryConfetti";
import { formatYear } from "@/lib/displayFormatting";
import { BackgroundAnimation } from "@/components/BackgroundAnimation";
import { ConfettiRef } from "@/components/magicui/confetti";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { logger } from "@/lib/logger";
import { GAME_CONFIG } from "@/lib/constants";
import { useScreenReaderAnnouncements } from "@/hooks/useScreenReaderAnnouncements";

// Type for validation result
type PuzzleIdValidation =
  | { valid: true; id: number; error?: never }
  | { valid: false; id?: never; error: string };

// Helper function to validate puzzle ID parameter
function isValidPuzzleId(idStr: string): PuzzleIdValidation {
  // Check if it's a valid number string
  if (!/^\d+$/.test(idStr)) {
    return { valid: false, error: "Invalid puzzle ID format" } as const;
  }

  const id = parseInt(idStr, 10);

  // Check if parsing was successful
  if (isNaN(id) || id < 1) {
    return { valid: false, error: "Invalid puzzle ID value" } as const;
  }

  // For now, just return valid if it's a positive number
  // Actual validation will happen when we try to fetch the puzzle
  return { valid: true, id } as const;
}

interface ArchivePuzzleContentProps {
  id: string;
}

function ArchivePuzzleContent({ id }: ArchivePuzzleContentProps): React.ReactElement {
  const router = useRouter();
  const validation = isValidPuzzleId(id);
  const confettiRef = useRef<ConfettiRef>(null);

  // States
  const [showSuccess, setShowSuccess] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [totalPuzzles, setTotalPuzzles] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // The puzzle ID is the puzzle number (1-based)
  const puzzleNumber = validation.valid && validation.id ? validation.id : 0;

  // Use game state for archive puzzle with puzzle number
  const chrondle = useRangeGame(puzzleNumber > 0 ? puzzleNumber : undefined);

  const readyState = isReady(chrondle.gameState) ? chrondle.gameState : null;

  const gameState = readyState
    ? {
        puzzle: {
          ...readyState.puzzle,
          year: readyState.puzzle.targetYear,
        },
        guesses: readyState.guesses,
        ranges: readyState.ranges,
        isGameOver: readyState.isComplete,
        totalScore: readyState.totalScore,
      }
    : {
        puzzle: null,
        guesses: [],
        ranges: [],
        isGameOver: false,
        totalScore: 0,
      };

  const isLoading =
    chrondle.gameState.status === "loading-puzzle" ||
    chrondle.gameState.status === "loading-auth" ||
    chrondle.gameState.status === "loading-progress";
  const isGameComplete = readyState ? readyState.isComplete : false;
  const hasWon = readyState ? readyState.hasWon : false;
  const remainingAttempts = readyState ? readyState.remainingAttempts : GAME_CONFIG.MAX_GUESSES;

  // Get target year from game state puzzle
  const targetYear = gameState.puzzle?.year || 2000;

  // Fetch total puzzles count for navigation
  useEffect(() => {
    async function fetchData() {
      if (!validation.valid) {
        setAnnouncement(`Error: ${validation.error}`);
        setIsValidated(true);
        return;
      }

      try {
        // Fetch total puzzles count for navigation
        const totalCount = await fetchTotalPuzzles();
        setTotalPuzzles(totalCount);

        // Check if puzzle number is valid
        if (validation.id > totalCount) {
          setFetchError(`Puzzle #${validation.id} does not exist. We have ${totalCount} puzzles.`);
          setAnnouncement(
            `Puzzle #${validation.id} does not exist. We have ${totalCount} puzzles.`,
          );
        }
      } catch (error) {
        logger.error("Failed to fetch total puzzles count:", error);
        setFetchError("Failed to load puzzle data");
        setAnnouncement("Error: Failed to load puzzle data");
      } finally {
        setIsValidated(true);
      }
    }

    fetchData();
  }, [validation]);

  // Use victory confetti hook for celebration
  useVictoryConfetti(confettiRef, {
    hasWon,
    isGameComplete,
    isMounted: isValidated, // Use isValidated as mounted state
    guessCount: gameState.ranges.length,
    disabled: false,
  });

  const [screenReaderLastRangeCount, setScreenReaderLastRangeCount] = useState(0);
  const rangeAnnouncement = useScreenReaderAnnouncements({
    ranges: gameState.ranges,
    lastRangeCount: screenReaderLastRangeCount,
    setLastRangeCount: setScreenReaderLastRangeCount,
  });

  // Handle victory announcement
  useEffect(() => {
    if (hasWon && !showSuccess && gameState.ranges.length > 0) {
      const lastRange = gameState.ranges[gameState.ranges.length - 1];
      if (lastRange.score > 0) {
        setShowSuccess(true);
        setAnnouncement(`Correct! The year was ${formatYear(targetYear)}`);
      }
    }
  }, [hasWon, targetYear, showSuccess, gameState.ranges]);

  // Handle navigation
  const handleNavigate = (direction: "prev" | "next"): void => {
    if (!validation.valid || !validation.id) return;

    const currentId = validation.id;
    const newId = direction === "prev" ? currentId - 1 : currentId + 1;

    if (newId >= 1 && newId <= totalPuzzles) {
      router.push(`/archive/puzzle/${newId}`);
    }
  };

  const liveAnnouncement = announcement || rangeAnnouncement;

  // Error state
  if (isValidated && (!validation.valid || fetchError || !gameState.puzzle)) {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader currentStreak={0} />

        <main className="mx-auto w-full max-w-2xl flex-grow px-4 py-8 sm:px-6 lg:px-8">
          <div className="py-12 text-center">
            <h1 className="text-foreground mb-4 text-2xl font-bold">
              {validation.error || fetchError || "Puzzle not found"}
            </h1>
            <Link href="/archive" className="text-primary hover:text-primary/80 underline">
              Return to Archive
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Loading state
  if (!isValidated || isLoading || !gameState.puzzle) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading puzzle...</div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <BackgroundAnimation
        guesses={gameState.guesses}
        targetYear={targetYear}
        isGameOver={isGameComplete}
      />
      {/* Use GameLayout with archive-specific header */}
      <GameLayout
        gameState={gameState}
        isGameComplete={isGameComplete}
        hasWon={hasWon}
        isLoading={isLoading}
        error={chrondle.gameState.status === "error" ? chrondle.gameState.error : null}
        onRangeCommit={chrondle.submitRange}
        remainingAttempts={remainingAttempts}
        confettiRef={confettiRef}
        isArchive={true}
        headerContent={
          <>
            <AppHeader currentStreak={0} />
            {/* Archive Navigation */}
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
                    onClick={(): void => handleNavigate("prev")}
                    disabled={validation.id === 1}
                    className="border-border hover:bg-muted rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  <span className="text-muted-foreground px-2 text-sm">
                    Puzzle #{validation.id}
                  </span>

                  <button
                    onClick={(): void => handleNavigate("next")}
                    disabled={validation.id === totalPuzzles}
                    className="border-border hover:bg-muted rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        }
        footerContent={<Footer />}
      />

      {/* Modals removed */}

      {/* Hint review modal temporarily disabled - needs proper implementation */}

      {/* Live Announcer for Screen Readers */}
      <LiveAnnouncer message={liveAnnouncement} />

      {/* Confetti is now handled by GameLayout */}
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ArchivePuzzlePage({ params }: PageProps): React.ReactElement {
  const { id } = use(params);

  return (
    <ArchiveErrorBoundary>
      <ArchivePuzzleContent id={id} />
    </ArchiveErrorBoundary>
  );
}
