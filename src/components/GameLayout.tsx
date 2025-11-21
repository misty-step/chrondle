"use client";

import React, { useState, useEffect } from "react";
import { GameInstructions } from "@/components/GameInstructions";
import { RangeInput } from "@/components/game/RangeInput";
import { HintIndicator } from "@/components/game/HintIndicator";
import { Confetti, ConfettiRef } from "@/components/magicui/confetti";
import { GameComplete } from "@/components/modals/GameComplete";
import { validateGameLayoutProps } from "@/lib/propValidation";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
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

  // Local state for hints revealed in current session (0-6)
  // Starts at 0 (first hint is free and always shown)
  const [hintsRevealed, setHintsRevealed] = useState(0);

  // Track the latest guess to trigger the stamp animation
  const [lastGuessStamp, setLastGuessStamp] = useState<RangeGuess | null>(null);

  // Reset hints when game completes or puzzle changes
  useEffect(() => {
    setHintsRevealed(0);
    setLastGuessStamp(null);
  }, [gameState.puzzle?.year, isGameComplete]);

  // Watch for new guesses to trigger stamp animation
  useEffect(() => {
    if (gameState.ranges.length > 0) {
      const latest = gameState.ranges[gameState.ranges.length - 1];
      // Only stamp if this is a new guess we haven't stamped yet
      // Simple check using array length would be enough usually, but explicit is better
      setLastGuessStamp(latest);

      // Clear the stamp after animation
      const timer = setTimeout(() => setLastGuessStamp(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState.ranges]); // Dependent on the whole array to catch changes in length or content

  const targetYear = gameState.puzzle?.year ?? 0;
  const totalScore = gameState.totalScore ?? 0;
  const puzzleNumber = gameState.puzzle?.puzzleNumber;

  // Handler for revealing hints
  const handleRevealHint = (hintIndex: number) => {
    // hintIndex is 0-based (0-5 for hints 2-6)
    // hintsRevealed should become hintIndex + 1
    setHintsRevealed(hintIndex + 1);
  };

  return (
    <div className="bg-background flex flex-1 flex-col">
      {/* Optional header content */}
      {headerContent && <div>{headerContent}</div>}

      {/* Main game content */}
      <main className="relative flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Stamp Overlay */}
        <AnimatePresence>
          {lastGuessStamp && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden">
              <motion.div
                initial={{ scale: 2, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: Math.random() * 4 - 2 }} // Slight random rotation
                exit={{ opacity: 0, scale: 1.1, transition: { duration: 0.5 } }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 15,
                  mass: 0.5,
                }}
                className={cn(
                  "material-stamp rounded-lg border-4 p-4 text-4xl font-black tracking-widest uppercase mix-blend-multiply backdrop-blur-[1px]",
                  // Color based on accuracy (logic simplified for visual impact)
                  // Ideally we'd check if the target year is in the range
                  lastGuessStamp.start <= targetYear && lastGuessStamp.end >= targetYear
                    ? "border-feedback-correct text-feedback-correct rotate-[-2deg]"
                    : "border-ink-900 text-ink-900 rotate-[2deg]",
                )}
              >
                {lastGuessStamp.start <= targetYear && lastGuessStamp.end >= targetYear
                  ? "LOCKED IN"
                  : "RECORDED"}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
              <div className="material-card group relative overflow-hidden p-6 sm:p-8">
                {/* Decorative corner accents */}
                <div className="border-parchment-300 absolute top-0 left-0 h-16 w-16 rounded-tl-xl border-t-2 border-l-2 opacity-50" />
                <div className="border-parchment-300 absolute right-0 bottom-0 h-16 w-16 rounded-br-xl border-r-2 border-b-2 opacity-50" />

                <div className="text-vermilion-500 mb-3 flex items-center gap-2 font-sans text-xs font-bold tracking-[0.2em] uppercase">
                  <span className="bg-vermilion-500/50 h-px w-8" />
                  Primary Source
                  <span className="bg-vermilion-500/50 h-px flex-1" />
                </div>
                <div className="text-ink-900 font-serif text-2xl leading-tight tracking-tight drop-shadow-sm sm:text-3xl">
                  {gameState.puzzle.events[0]}
                </div>
              </div>

              {/* Additional Revealed Hints */}
              {hintsRevealed > 0 && (
                <div className="space-y-3">
                  {gameState.puzzle.events.slice(1, hintsRevealed + 1).map((hint, index) => (
                    <div key={index} className="material-paper relative p-4">
                      <div className="text-ink-500 mb-1.5 font-sans text-xs font-semibold tracking-wider uppercase">
                        Clue {index + 2}
                      </div>
                      <div className="text-ink-900 font-serif text-lg leading-snug">{hint}</div>
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
