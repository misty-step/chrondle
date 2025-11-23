"use client";

import { useState } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrderGame } from "@/hooks/useOrderGame";
import { OrderReveal } from "@/components/order/OrderReveal";
import { OrderGameBoard } from "@/components/order/OrderGameBoard";
import { AppHeader } from "@/components/AppHeader";
import { LayoutContainer } from "@/components/LayoutContainer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { copyOrderShareTextToClipboard, type OrderShareResult } from "@/lib/order/shareCard";
import { logger } from "@/lib/logger";

interface OrderGameIslandProps {
  preloadedPuzzle: Preloaded<typeof api.orderPuzzles.getDailyOrderPuzzle>;
}

export function OrderGameIsland({ preloadedPuzzle }: OrderGameIslandProps) {
  const puzzle = usePreloadedQuery(preloadedPuzzle);
  const { gameState, reorderEvents, takeHint, commitOrdering } = useOrderGame(undefined, puzzle);
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
        subMessage="Securing your streak and restoring hints"
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
      try {
        const results: OrderShareResult[] = gameState.correctOrder.map((id, idx) =>
          gameState.finalOrder[idx] === id ? "correct" : "incorrect",
        );

        await copyOrderShareTextToClipboard({
          dateLabel: gameState.puzzle.date,
          puzzleNumber: gameState.puzzle.puzzleNumber,
          results,
          score: gameState.score,
        });

        setShareFeedback("Copied to clipboard!");
      } catch (error) {
        logger.error("Failed to copy Order share text", error);
        setShareFeedback("Share failed. Try again.");
      }
    };

    return (
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={false} mode="order" />
        <main className="flex-1 py-16">
          <LayoutContainer className="flex max-w-3xl flex-col gap-6">
            <OrderReveal
              events={gameState.puzzle.events}
              finalOrder={gameState.finalOrder}
              correctOrder={gameState.correctOrder}
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
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={false} mode="order" />
      <main
        className="flex-1 py-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        <LayoutContainer className="flex w-full max-w-5xl flex-col gap-6">
          <OrderGameBoard
            gameState={gameState as import("@/types/orderGameState").ReadyState}
            reorderEvents={reorderEvents}
            takeHint={takeHint}
            commitOrdering={commitOrdering}
          />
        </LayoutContainer>
      </main>
    </div>
  );
}
