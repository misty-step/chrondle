"use client";

import { useState } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrderGame } from "@/hooks/useOrderGame";
import { useToast } from "@/hooks/use-toast";
import { useWebShare } from "@/hooks/useWebShare";
import { OrderReveal } from "@/components/order/OrderReveal";
import { OrderGameBoard } from "@/components/order/OrderGameBoard";
import { GameModeLayout } from "@/components/GameModeLayout";
import { LayoutContainer } from "@/components/LayoutContainer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { generateArchivalShareText } from "@/lib/order/shareCard";
import type { ReadyState } from "@/types/orderGameState";

interface OrderGameIslandProps {
  preloadedPuzzle: Preloaded<typeof api.orderPuzzles.getDailyOrderPuzzle>;
}

export function OrderGameIsland({ preloadedPuzzle }: OrderGameIslandProps) {
  const puzzle = usePreloadedQuery(preloadedPuzzle);
  const { addToast } = useToast();
  const { share, shareMethod } = useWebShare();
  const { gameState, reorderEvents, submitAttempt, isSubmitting, lastError } = useOrderGame(
    undefined,
    puzzle,
    addToast,
  );
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  if (gameState.status === "loading-puzzle") {
    return (
      <LoadingScreen
        intent="order"
        stage="fetching"
        message="Loading Order puzzle…"
        subMessage="Fetching events and your progress"
      />
    );
  }

  if (gameState.status === "loading-auth" || gameState.status === "loading-progress") {
    return (
      <LoadingScreen
        intent="order"
        stage="hydrating"
        message="Preparing your Order session…"
        subMessage="Restoring your progress"
      />
    );
  }

  if (gameState.status === "error") {
    return (
      <LoadingScreen
        intent="order"
        stage="readying"
        message="Something went wrong"
        subMessage={gameState.error}
      />
    );
  }

  if (gameState.status === "completed") {
    const handleShare = async () => {
      const text = generateArchivalShareText({
        puzzleNumber: gameState.puzzle.puzzleNumber,
        score: gameState.score,
        attempts: gameState.attempts,
      });

      const success = await share(text);

      if (success) {
        setShareFeedback(shareMethod === "webshare" ? "Shared!" : "Copied to clipboard!");
      } else {
        setShareFeedback("Share failed. Try again.");
      }
    };

    return (
      <GameModeLayout mode="order" puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={false}>
        <LayoutContainer className="flex max-w-4xl flex-col gap-6">
          <OrderReveal
            score={gameState.score}
            puzzleNumber={gameState.puzzle.puzzleNumber}
            onShare={handleShare}
          />
          {shareFeedback && (
            <p className="text-muted-foreground text-center text-sm" role="status">
              {shareFeedback}
            </p>
          )}
        </LayoutContainer>
      </GameModeLayout>
    );
  }

  return (
    <GameModeLayout mode="order" puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={false}>
      <LayoutContainer className="flex w-full max-w-4xl flex-col gap-6">
        <OrderGameBoard
          gameState={gameState as ReadyState}
          reorderEvents={reorderEvents}
          submitAttempt={submitAttempt}
          isSubmitting={isSubmitting}
          lastError={lastError}
        />
      </LayoutContainer>
    </GameModeLayout>
  );
}
