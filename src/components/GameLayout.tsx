"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { GameInstructions } from "@/components/GameInstructions";
import { KeepPlaying } from "@/components/KeepPlaying";
import { HintIndicator } from "@/components/game/HintIndicator";
import { Confetti, ConfettiRef } from "@/components/magicui/confetti";
import { GameComplete } from "@/components/modals/GameComplete";
import { validateGameLayoutProps } from "@/lib/propValidation";
import type { RangeGuess } from "@/types/range";
import { playSound } from "@/lib/sound/soundEngine";
import { ReturnTomorrowCard } from "@/components/game/ReturnTomorrowCard";
import { HistoricalContextCard } from "@/components/HistoricalContextCard";

// The classic range input is rendered by three routes (home, /classic,
// /archive/puzzle/[id]). Pulling it through one dynamic boundary keeps it in a
// single shared chunk instead of being inlined into each route bundle. SSR is
// preserved (default), so the input is server-rendered with no loading flash.
const RangeInput = dynamic(
  () => import("@/components/game/RangeInput").then((m) => ({ default: m.RangeInput })),
  { ssr: true },
);

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

  /** Live streak from the page's streak instance (post-completion value) */
  currentStreak?: number;
}

interface GameLayoutSessionState {
  sessionKey: string;
  hintsRevealed: number;
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
    currentStreak,
  } = props;

  const sessionKey = `${gameState.puzzle?.year ?? "none"}:${gameState.puzzle?.puzzleNumber ?? "daily"}:${isGameComplete ? "complete" : "active"}`;
  const [sessionState, setSessionState] = useState<GameLayoutSessionState>(() => ({
    sessionKey,
    hintsRevealed: 0,
  }));
  const currentSessionState =
    sessionState.sessionKey === sessionKey
      ? sessionState
      : {
          sessionKey,
          hintsRevealed: 0,
        };

  const hintsRevealed = currentSessionState.hintsRevealed;

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

  // After the one-shot guess is locked in, move focus to the results
  // summary - the next useful continuation point once RangeInput itself
  // unmounts. tabIndex=-1 makes the wrapper programmatically focusable
  // without adding it to the tab order.
  const resultsRef = useRef<HTMLDivElement>(null);
  const wasGameComplete = useRef(isGameComplete);
  const submittedHere = useRef(false);
  const handleRangeCommit: GameLayoutProps["onRangeCommit"] = (range) => {
    submittedHere.current = true;
    return onRangeCommit(range);
  };
  useEffect(() => {
    if (isGameComplete && !wasGameComplete.current) {
      resultsRef.current?.focus();
      if (submittedHere.current && hasWon) playSound("success");
      submittedHere.current = false;
    }
    wasGameComplete.current = isGameComplete;
  }, [hasWon, isGameComplete]);

  return (
    <div className="bg-background flex flex-1 flex-col">
      {/* Optional header content */}
      {headerContent && <div>{headerContent}</div>}

      {/* Main game content */}
      <div className="relative flex-1 px-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-6 sm:space-y-8">
          {/* Active Game: Header */}
          {!isGameComplete && <GameInstructions />}

          {/* Completed Game: Full-width Instructions */}
          {isGameComplete && (
            <GameInstructions
              isGameComplete={isGameComplete}
              hasWon={hasWon}
              targetYear={targetYear}
            />
          )}

          {/* Historical Events Hints - Minimal reveal system */}
          {!isGameComplete && gameState.puzzle && (
            <div className="space-y-5">
              {/* The Puzzle Event - Hero Display */}
              <div className="border-border bg-surface-elevated rounded-2xl border p-5 sm:p-8">
                <p className="text-muted-foreground mb-3 text-sm font-medium">
                  Clue 1 of {gameState.puzzle.events.length}
                </p>
                <div className="font-display text-foreground text-2xl leading-snug font-medium tracking-tight sm:text-3xl">
                  {gameState.puzzle.events[0]}
                </div>
              </div>

              {/* Additional Revealed Hints */}
              {hintsRevealed > 0 && (
                <div className="space-y-3">
                  {gameState.puzzle.events.slice(1, hintsRevealed + 1).map((hint, index) => (
                    <div
                      key={index}
                      className="border-border bg-surface-elevated rounded-xl border p-4 sm:p-5"
                    >
                      <div className="text-muted-foreground mb-1.5 text-sm font-medium">
                        Clue {index + 2}
                      </div>
                      <div className="text-foreground font-body text-base leading-relaxed sm:text-lg">
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
              onCommit={handleRangeCommit}
              disabled={isLoading}
              className=""
              hintsUsed={hintsRevealed}
              isOneGuessMode={true}
            />
          )}

          {/* Game Complete Summary */}
          {isGameComplete && (
            <>
              <div
                ref={resultsRef}
                tabIndex={-1}
                data-testid="results-focus-anchor"
                className="outline-none"
              >
                <GameComplete
                  ranges={gameState.ranges}
                  totalScore={totalScore}
                  hasWon={hasWon}
                  puzzleNumber={puzzleNumber}
                  targetYear={targetYear}
                  totalHints={gameState.puzzle?.events.length}
                  events={gameState.puzzle?.events}
                />
              </div>
              <HistoricalContextCard context={gameState.puzzle?.historicalContext} />
              {!isArchive && (
                <ReturnTomorrowCard
                  timeString={countdown?.timeString ?? ""}
                  mode="classic"
                  currentStreak={currentStreak}
                />
              )}
              <KeepPlaying currentMode="classic" />
            </>
          )}
        </div>
      </div>

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
