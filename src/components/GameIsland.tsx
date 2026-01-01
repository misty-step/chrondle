"use client";

/**
 * GameIsland - Main Client-Side Game Component
 *
 * Deep module that orchestrates all game interactivity.
 * No props required - fetches puzzle by local date internally.
 *
 * Architecture: No SSR preload. Always fetches by local date.
 * This eliminates timezone mismatch bugs at the cost of a brief
 * loading skeleton on first render.
 */

import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue, lazy } from "react";
import { useRangeGame } from "@/hooks/useRangeGame";
import { isReady, getPuzzle } from "@/types/gameState";
import { useStreak } from "@/hooks/useStreak";
import { useCountdown } from "@/hooks/useCountdown";
import { useVictoryConfetti } from "@/hooks/useVictoryConfetti";
import { useScreenReaderAnnouncements } from "@/hooks/useScreenReaderAnnouncements";
import { logger } from "@/lib/logger";
import { GAME_CONFIG } from "@/lib/constants";
import { AchievementModal, LazyModalWrapper } from "@/components/LazyModals";
import { GameLayout, LiveAnnouncer, BackgroundAnimation } from "@/components/LazyComponents";
import { ConfettiRef } from "@/components/magicui/confetti";
import { GameModeLayout } from "@/components/GameModeLayout";

// Lazy load AnalyticsDashboard for development/debug mode only
const AnalyticsDashboard = lazy(() =>
  import("@/components/AnalyticsDashboard").then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);

export function GameIsland() {
  // Debug state
  const [debugMode, setDebugMode] = useState(false);

  // Confetti ref for victory celebration
  const confettiRef = useRef<ConfettiRef>(null);

  // Core game hook - fetches puzzle by local date, no preload
  const { gameState, submitRange, resetGame } = useRangeGame();

  // Defer non-critical state values for better performance
  const deferredGameState = useDeferredValue(gameState);

  // Derive display state from gameState
  // Use getPuzzle() to show puzzle during auth/progress loading (no flash)
  const gameLogic = useMemo(() => {
    const ready = isReady(gameState);
    const deferredReady = isReady(deferredGameState);
    const puzzle = getPuzzle(gameState);

    return {
      // Core game state for GameLayout
      // Puzzle is available during loading-auth and loading-progress (no flash!)
      gameState: puzzle
        ? {
            puzzle: { ...puzzle, year: puzzle.targetYear },
            guesses: ready ? gameState.guesses : [],
            ranges: ready ? gameState.ranges : [],
            isGameOver: ready ? gameState.isComplete : false,
            totalScore: ready ? gameState.totalScore : 0,
          }
        : {
            puzzle: null,
            guesses: [],
            ranges: [],
            isGameOver: false,
            totalScore: 0,
          },

      // Loading state - only loading-puzzle blocks the UI
      isLoading: gameState.status === "loading-puzzle",

      // Error state
      error: gameState.status === "error" ? gameState.error : null,

      // Completion state (use deferred for non-critical)
      isGameComplete: deferredReady ? deferredGameState.isComplete : false,
      hasWon: deferredReady ? deferredGameState.hasWon : false,

      // Remaining attempts
      remainingAttempts: deferredReady
        ? deferredGameState.remainingAttempts
        : GAME_CONFIG.MAX_GUESSES,

      // Actions
      submitRange,
      resetGame,
    };
  }, [gameState, deferredGameState, submitRange, resetGame]);

  // Puzzle info for header - show as soon as puzzle is available (not just when ready)
  const puzzle = getPuzzle(gameState);
  const puzzleNumber = puzzle?.puzzleNumber;
  const puzzleDate = puzzle?.date;

  // Streak system
  const { streakData, updateStreak, hasNewAchievement, newAchievement, clearNewAchievement } =
    useStreak();

  // Countdown for next puzzle
  const countdown = useCountdown();

  // UI state
  const [, setValidationError] = useState("");

  // Guard to prevent multiple game over handling
  const hasHandledGameOverRef = useRef(false);

  // Handle game over with streak updates
  const handleGameOver = useCallback(
    (won: boolean, attemptCount: number) => {
      logger.info(`Game complete: ${won ? "Won" : "Lost"} in ${attemptCount} range attempts`);

      // Update streak (dual-mode):
      // - Authenticated: no-op (backend submitGuess mutation already updated)
      // - Anonymous: calculate and persist to localStorage
      updateStreak(won);
    },
    [updateStreak],
  );

  // Watch for game completion
  useEffect(() => {
    // Only handle game over once per completion
    if (gameLogic.isGameComplete && !gameLogic.isLoading && !hasHandledGameOverRef.current) {
      hasHandledGameOverRef.current = true;
      const attemptCount = gameLogic.gameState.ranges.length;
      handleGameOver(gameLogic.hasWon, attemptCount);
    }

    // Reset guard when game resets (for debug mode or archive navigation)
    if (!gameLogic.isGameComplete) {
      hasHandledGameOverRef.current = false;
    }
  }, [
    gameLogic.isGameComplete,
    gameLogic.hasWon,
    gameLogic.isLoading,
    gameLogic.gameState.ranges.length,
    handleGameOver,
  ]);

  // Track client-side mount state for confetti
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Victory confetti effect
  useVictoryConfetti(confettiRef, {
    hasWon: gameLogic.hasWon,
    isGameComplete: gameLogic.isGameComplete,
    isMounted,
    guessCount: gameLogic.gameState.ranges.length,
  });

  // Track last range count for screen reader announcements
  const [screenReaderLastRangeCount, setScreenReaderLastRangeCount] = useState(0);

  // Screen reader announcements
  const announcement = useScreenReaderAnnouncements({
    ranges: gameLogic.gameState.ranges,
    lastRangeCount: screenReaderLastRangeCount,
    setLastRangeCount: setScreenReaderLastRangeCount,
  });

  // Check for debug mode on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const debug = urlParams.get("debug") === "true";
      setDebugMode(debug);

      if (debug) {
        logger.debug("Debug mode enabled via URL parameter");
      }
    }
  }, []);

  return (
    <GameModeLayout
      mode="classic"
      puzzleNumber={puzzleNumber}
      puzzleDate={puzzleDate}
      currentStreak={streakData.currentStreak}
      isDebugMode={debugMode}
      backgroundAnimation={
        <BackgroundAnimation
          guesses={gameLogic.gameState.guesses}
          targetYear={gameLogic.gameState.puzzle?.year || new Date().getFullYear()}
          isGameOver={gameLogic.isGameComplete}
        />
      }
      _confettiRef={confettiRef}
      modals={
        <LazyModalWrapper>
          <AchievementModal
            isOpen={hasNewAchievement}
            onClose={clearNewAchievement}
            achievement={newAchievement || ""}
          />
        </LazyModalWrapper>
      }
      screenReaderAnnouncements={<LiveAnnouncer message={announcement} />}
      debugContent={<AnalyticsDashboard />}
    >
      {!gameLogic.isLoading && gameLogic.error && (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="bg-destructive/10 text-destructive max-w-md rounded-sm p-6 text-center">
            <h2 className="mb-2 text-xl font-bold">Unable to Load Puzzle</h2>
            <p className="mb-4">{gameLogic.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded px-4 py-2 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

      {!gameLogic.error && (
        <GameLayout
          gameState={gameLogic.gameState}
          isGameComplete={gameLogic.isGameComplete}
          hasWon={gameLogic.hasWon}
          isLoading={gameLogic.isLoading}
          error={gameLogic.error}
          onRangeCommit={gameLogic.submitRange}
          remainingAttempts={gameLogic.remainingAttempts}
          countdown={countdown}
          confettiRef={confettiRef}
          onValidationError={setValidationError}
        />
      )}
    </GameModeLayout>
  );
}
