"use client";

import React, { useMemo, useState } from "react";
import { GameInstructions } from "@/components/GameInstructions";
import { RangeInput } from "@/components/game/RangeInput";
import { HintIndicator } from "@/components/game/HintIndicator";
import { Confetti, ConfettiRef } from "@/components/magicui/confetti";
import { GameComplete } from "@/components/modals/GameComplete";
import { validateGameLayoutProps } from "@/lib/propValidation";
import { motion } from "motion/react";
import { cn, seededRandom } from "@/lib/utils";
import type { RangeGuess } from "@/types/range";

export interface GameLayoutProps {
  // Core game state
  gameState: {
    puzzle: {
      year: number;
      events: string[];
      puzzleNumber?: number;
      historicalContext?: string;
    } | null;
    guesses: number[];
    ranges: RangeGuess[];
    isGameOver: boolean;
    totalScore: number;
  };
  isGameComplete: boolean;
  hasWon: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  onRangeCommit: (range: {
    start: number;
    end: number;
    hintsUsed: number;
  }) => void | Promise<boolean>;

  // Optional header content (nav controls for archive, settings for homepage)
  headerContent?: React.ReactNode;

  // Optional footer content
  footerContent?: React.ReactNode;

  // Validation error handler
  onValidationError?: (message: string) => void;

  // Confetti config
  confettiRef?: React.RefObject<ConfettiRef>;

  // Debug mode
  debugMode?: boolean;

  // Countdown data
  countdown?: {
    timeString: string;
    isComplete: boolean;
    isLoading: boolean;
    error: string | null;
  };

  // Archive indicator
  isArchive?: boolean;
  remainingAttempts: number;
}

interface GameLayoutSessionState {
  sessionKey: string;
  hintsRevealed: number;
  dismissedStampTimestamp: number | null;
}

export function GameLayout(props: GameLayoutProps) {
  // Validate props in development
  validateGameLayoutProps(props);

  const {
    gameState,
    isGameComplete,
    hasWon,
    isLoading,
    onRangeCommit,
    headerContent,
    footerContent,
    confettiRef,
    countdown,
    isArchive = false,
  } = props;

  const sessionKey = `${gameState.puzzle?.year ?? "none"}:${gameState.puzzle?.puzzleNumber ?? "daily"}:${isGameComplete ? "complete" : "active"}`;
  const [sessionState, setSessionState] = useState<GameLayoutSessionState>(() => ({
    sessionKey,
    hintsRevealed: 0,
    dismissedStampTimestamp: null,
  }));
  const currentSessionState =
    sessionState.sessionKey === sessionKey
      ? sessionState
      : {
          sessionKey,
          hintsRevealed: 0,
          dismissedStampTimestamp: null,
        };

  const latestGuessStamp = gameState.ranges.at(-1) ?? null;
  const lastGuessStamp =
    latestGuessStamp && latestGuessStamp.timestamp !== currentSessionState.dismissedStampTimestamp
      ? latestGuessStamp
      : null;
  const hintsRevealed = currentSessionState.hintsRevealed;

  const stampRotation = useMemo(() => {
    if (!lastGuessStamp?.timestamp) {
      return 0;
    }
    // seededRandom returns [0, 1), scale to [-2, 2] for slight rotation variance
    return seededRandom(lastGuessStamp.timestamp) * 4 - 2;
  }, [lastGuessStamp?.timestamp]);

  const targetYear = gameState.puzzle?.year ?? 0;
  const totalScore = gameState.totalScore ?? 0;
  const puzzleNumber = gameState.puzzle?.puzzleNumber;

  // Handler for revealing hints
  const handleRevealHint = (hintIndex: number) => {
    // hintIndex is 0-based (0-5 for hints 2-6)
    // hintsRevealed should become hintIndex + 1
    setSessionState({
      ...currentSessionState,
      hintsRevealed: hintIndex + 1,
    });
  };

  const dismissStamp = (stamp: RangeGuess | null) => {
    setSessionState({
      ...currentSessionState,
      dismissedStampTimestamp: stamp?.timestamp ?? null,
    });
  };

  return (
    <div className="bg-background flex flex-1 flex-col">
      {/* Optional header content */}
      {headerContent && <div>{headerContent}</div>}

      {/* Main game content */}
      <main className="relative flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Stamp Overlay - Tap to dismiss */}
        {lastGuessStamp && (
          <div
            className="pointer-events-auto absolute inset-0 z-50 flex cursor-pointer items-center justify-center overflow-hidden"
            onClick={() => dismissStamp(lastGuessStamp)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dismissStamp(lastGuessStamp);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Dismiss stamp, tap to continue"
          >
            <motion.div
              key={lastGuessStamp.timestamp}
              initial={{ scale: 2, opacity: 0, rotate: -15 }}
              animate={{
                scale: [2, 1, 1, 1.05],
                opacity: [0, 1, 1, 0],
                rotate: [-15, stampRotation, stampRotation, stampRotation],
              }}
              transition={{
                duration: 1.2,
                times: [0, 0.18, 0.78, 1],
                ease: "easeOut",
              }}
              onAnimationComplete={() => dismissStamp(lastGuessStamp)}
              className={cn(
                "flex flex-col items-center gap-2 rounded border-4 p-4 text-4xl font-black tracking-widest uppercase mix-blend-multiply backdrop-blur-[1px] dark:mix-blend-normal",
                lastGuessStamp.start <= targetYear && lastGuessStamp.end >= targetYear
                  ? "border-feedback-correct text-feedback-correct rotate-[-2deg]"
                  : "border-outline-default text-body-primary rotate-[2deg]",
              )}
            >
              {lastGuessStamp.start <= targetYear && lastGuessStamp.end >= targetYear
                ? "LOCKED IN"
                : "RECORDED"}
              <span className="text-body-secondary text-xs font-medium tracking-normal normal-case opacity-70">
                Tap to continue
              </span>
            </motion.div>
          </div>
        )}

        <div className="mx-auto w-full max-w-2xl space-y-10 sm:space-y-12">
          {/* Active Game: Header */}
          {!isGameComplete && (
            <GameInstructions isGameComplete={false} hasWon={false} isArchive={isArchive} />
          )}

          {/* Completed Game: Full-width Instructions */}
          {isGameComplete && (
            <GameInstructions
              isGameComplete={isGameComplete}
              hasWon={hasWon}
              targetYear={targetYear}
              timeString={countdown?.timeString}
              isArchive={isArchive}
              historicalContext={gameState.puzzle?.historicalContext}
            />
          )}

          {/* Historical Events Hints - Minimal reveal system */}
          {!isGameComplete && gameState.puzzle && (
            <div className="space-y-5">
              {/* The Puzzle Event - Hero Display */}
              <div className="paper-edge group dark:border-border dark:bg-card relative overflow-hidden rounded border border-[#d3d6da] bg-white p-8 sm:p-10">
                {/* Removed decorative corner accents - unnecessary visual noise */}

                <div className="text-body-primary mb-4 flex items-center gap-2 font-sans text-xs font-bold tracking-wider uppercase">
                  <span className="bg-primary/50 h-px w-8" />
                  Primary Clue
                  <span className="bg-primary/50 h-px flex-1" />
                </div>
                <div className="text-body-primary font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
                  {gameState.puzzle.events[0]}
                </div>
              </div>

              {/* Additional Revealed Hints */}
              {hintsRevealed > 0 && (
                <div className="space-y-2">
                  {gameState.puzzle.events.slice(1, hintsRevealed + 1).map((hint, index) => (
                    <div
                      key={index}
                      className="paper-edge border-primary/30 relative border-l-4 p-3"
                    >
                      <div className="text-body-secondary mb-1 font-sans text-xs font-semibold uppercase">
                        Clue {index + 2}
                      </div>
                      <div className="text-body-primary font-body text-base leading-snug">
                        {hint}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Minimal Hint Indicator */}
              <HintIndicator
                hintsRevealed={hintsRevealed}
                totalHints={gameState.puzzle.events.length}
                onRevealHint={() => handleRevealHint(hintsRevealed)}
                disabled={isGameComplete || isLoading}
              />
            </div>
          )}

          {/* Range Input - After hints so user can adjust based on information */}
          {!isGameComplete && (
            <RangeInput
              onCommit={onRangeCommit}
              disabled={isLoading}
              className=""
              hintsUsed={hintsRevealed}
              isOneGuessMode={true}
            />
          )}

          {/* Game Complete Summary */}
          {isGameComplete && (
            <GameComplete
              ranges={gameState.ranges}
              totalScore={totalScore}
              hasWon={hasWon}
              puzzleNumber={puzzleNumber}
              targetYear={targetYear}
              totalHints={gameState.puzzle?.events.length}
              events={gameState.puzzle?.events}
            />
          )}
        </div>
      </main>

      {/* Optional footer content */}
      {footerContent}

      {/* Victory Confetti - Always with manualstart=true */}
      {confettiRef && (
        <Confetti
          ref={confettiRef}
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            width: "100%",
            height: "100%",
            position: "fixed",
            top: 0,
          }}
          manualstart={true}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
