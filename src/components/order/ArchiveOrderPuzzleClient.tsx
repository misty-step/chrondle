"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { OrderPuzzle, ReadyState } from "@/types/orderGameState";
import { useOrderGame } from "@/hooks/useOrderGame";
import { OrderReveal } from "@/components/order/OrderReveal";
import { OrderGameBoard } from "@/components/order/OrderGameBoard";
import { AppHeader } from "@/components/AppHeader";
import { LayoutContainer } from "@/components/LayoutContainer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Footer } from "@/components/Footer";
import { copyGolfShareTextToClipboard } from "@/lib/order/shareCard";
import { logger } from "@/lib/logger";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";

interface ArchiveOrderPuzzleClientProps {
  puzzleNumber: number;
  initialPuzzle: OrderPuzzle;
}

export function ArchiveOrderPuzzleClient({
  puzzleNumber,
  initialPuzzle,
}: ArchiveOrderPuzzleClientProps): React.ReactElement {
  const { gameState, reorderEvents, submitAttempt } = useOrderGame(puzzleNumber, initialPuzzle);
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
      try {
        await copyGolfShareTextToClipboard({
          puzzleNumber: gameState.puzzle.puzzleNumber,
          score: gameState.score,
          attempts: gameState.attempts,
        });

        setShareFeedback("Copied to clipboard!");
      } catch (error) {
        logger.error("Failed to copy Order share text", error);
        setShareFeedback("Share failed. Try again.");
      }
    };

    return (
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={true} mode="order" />
        <main className="flex-1 py-16">
          <LayoutContainer className="flex max-w-3xl flex-col gap-6">
            <div className="mb-4">
              <Link
                href="/archive/order"
                className="text-muted-foreground hover:text-body-primary text-sm"
              >
                ← Back to Order Archive
              </Link>
            </div>
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
        <Footer />
      </div>
    );
  }

  return (
    <ArchiveErrorBoundary>
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={true} mode="order" />
        <main
          className="flex-1 py-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        >
          <LayoutContainer className="flex w-full max-w-5xl flex-col gap-6">
            <div className="mb-4">
              <Link
                href="/archive/order"
                className="text-muted-foreground hover:text-body-primary text-sm"
              >
                ← Back to Order Archive
              </Link>
            </div>
            <OrderGameBoard
              gameState={gameState as ReadyState}
              reorderEvents={reorderEvents}
              submitAttempt={submitAttempt}
            />
          </LayoutContainer>
        </main>
        <Footer />
      </div>
    </ArchiveErrorBoundary>
  );
}
