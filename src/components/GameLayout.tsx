"use client";

import React, { useState, useEffect } from "react";
import { GameInstructions } from "@/components/GameInstructions";
import { RangeInput } from "@/components/game/RangeInput";
import { HintIndicator } from "@/components/game/HintIndicator";
import { Confetti, ConfettiRef } from "@/components/magicui/confetti";
import { GameComplete } from "@/components/modals/GameComplete";
import { validateGameLayoutProps } from "@/lib/propValidation";
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

  // Reset hints when game completes or puzzle changes
  useEffect(() => {
    setHintsRevealed(0);
  }, [gameState.puzzle?.year, isGameComplete]);

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
      <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
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
              <div className="border-primary bg-primary/10 rounded-xl border-2 p-5 shadow-md sm:p-6">
                <div className="text-primary mb-2 text-xs font-bold tracking-wider uppercase">
                  The Event
                </div>
                <div className="text-foreground text-base leading-relaxed sm:text-lg">
                  {gameState.puzzle.events[0]}
                </div>
              </div>

              {/* Additional Revealed Hints */}
              {hintsRevealed > 0 && (
                <div className="space-y-3">
                  {gameState.puzzle.events.slice(1, hintsRevealed + 1).map((hint, index) => (
                    <div
                      key={index}
                      className="border-primary/40 bg-primary/5 rounded-lg border p-4 shadow-sm"
                    >
                      <div className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
                        Clue {index + 2}
                      </div>
                      <div className="text-sm">{hint}</div>
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
