"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { OrderEvent, OrderHint, OrderPuzzle, OrderScore } from "@/types/orderGameState";
import type { MutationError } from "@/observability/mutationErrorAdapter";
import { useOrderGame } from "@/hooks/useOrderGame";
import { HintDisplay } from "@/components/order/HintDisplay";
import { OrderReveal } from "@/components/order/OrderReveal";
import { OrderEventList } from "@/components/order/OrderEventList";
import { DocumentHeader } from "@/components/order/DocumentHeader";
import { AppHeader } from "@/components/AppHeader";
import { LayoutContainer } from "@/components/LayoutContainer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateAnchorHint, generateBracketHint, generateRelativeHint } from "@/lib/order/hints";
import { deriveLockedPositions } from "@/lib/order/engine";
import { calculateOrderScore } from "@/lib/order/scoring";
import { copyOrderShareTextToClipboard, type OrderShareResult } from "@/lib/order/shareCard";
import { logger } from "@/lib/logger";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { hashHintContext } from "@/lib/order/hashHintContext";

type HintType = OrderHint["type"];

interface ArchiveOrderPuzzleClientProps {
  puzzleNumber: number;
  initialPuzzle: OrderPuzzle;
}

export function ArchiveOrderPuzzleClient({
  puzzleNumber,
  initialPuzzle,
}: ArchiveOrderPuzzleClientProps): React.ReactElement {
  const { gameState, reorderEvents, takeHint, commitOrdering } = useOrderGame(
    puzzleNumber,
    initialPuzzle,
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
        subMessage="Restoring hints and streaks"
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
        <AppHeader puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={true} mode="order" />
        <main className="flex-1 py-16">
          <LayoutContainer className="flex max-w-3xl flex-col gap-6">
            <div className="mb-4">
              <Link
                href="/archive/order"
                className="text-muted-foreground hover:text-primary text-sm"
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
      <ReadyArchiveOrderGame
        puzzle={gameState.puzzle}
        currentOrder={gameState.currentOrder}
        hints={gameState.hints}
        reorderEvents={reorderEvents}
        takeHint={takeHint}
        onCommit={commitOrdering}
      />
    </ArchiveErrorBoundary>
  );
}

interface ReadyArchiveOrderGameProps {
  puzzle: OrderPuzzle;
  currentOrder: string[];
  hints: OrderHint[];
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  takeHint: (hint: OrderHint) => void;
  onCommit: (score: OrderScore) => Promise<[boolean, null] | [null, MutationError]>;
}

function ReadyArchiveOrderGame({
  puzzle,
  currentOrder,
  hints,
  reorderEvents,
  takeHint,
  onCommit,
}: ReadyArchiveOrderGameProps) {
  const { addToast } = useToast();
  const toast = addToast;
  const [pendingHintType, setPendingHintType] = useState<HintType | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  const correctOrder = useMemo(
    () =>
      [...puzzle.events]
        .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
        .map((event) => event.id),
    [puzzle.events],
  );

  const puzzleSeed = useMemo(() => hashHintContext([puzzle.seed]), [puzzle.seed]);

  const disabledHintTypes: Partial<Record<HintType, boolean>> = useMemo(
    () => ({
      anchor: hints.some((hint) => hint.type === "anchor"),
      relative: hints.some((hint) => hint.type === "relative"),
      bracket: hints.some((hint) => hint.type === "bracket"),
    }),
    [hints],
  );

  const lockedPositions = useMemo(() => deriveLockedPositions(hints), [hints]);

  const hintsByEvent = useMemo(() => {
    const grouped: Record<string, OrderHint[]> = {};
    for (const hint of hints) {
      const eventId =
        hint.type === "anchor" || hint.type === "bracket"
          ? hint.eventId
          : hint.type === "relative"
            ? hint.earlierEventId
            : null;
      if (eventId) {
        grouped[eventId] = grouped[eventId] || [];
        grouped[eventId].push(hint);
      }
    }
    return grouped;
  }, [hints]);

  const handleOrderingChange = useCallback(
    (nextOrdering: string[], movedId?: string) => {
      const resolvedId = movedId ?? findMovedEventId(currentOrder, nextOrdering);
      if (!resolvedId) {
        return;
      }

      const fromIndex = currentOrder.indexOf(resolvedId);
      const toIndex = nextOrdering.indexOf(resolvedId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return;
      }

      reorderEvents(fromIndex, toIndex);
    },
    [currentOrder, reorderEvents],
  );

  const requestHint = useCallback(
    (type: HintType) => {
      if (pendingHintType || disabledHintTypes[type]) {
        return;
      }

      setPendingHintType(type);
      setHintError(null);

      try {
        const hint = createHintForType(type, {
          currentOrder,
          events: puzzle.events,
          hints,
          correctOrder,
          puzzleSeed,
        });
        takeHint(hint);
      } catch (error) {
        logger.error("Failed to generate Order hint", error);
        setHintError("Failed to generate hint. Please try again.");
      } finally {
        setPendingHintType(null);
      }
    },
    [
      pendingHintType,
      disabledHintTypes,
      currentOrder,
      puzzle.events,
      hints,
      correctOrder,
      puzzleSeed,
      takeHint,
    ],
  );

  const handleCommit = useCallback(async () => {
    const score = calculateOrderScore(currentOrder, puzzle.events, hints.length);
    const [success, error] = await onCommit(score);
    if (!success && error) {
      toast({ title: "Submit failed", description: error.message, variant: "destructive" });
    }
  }, [currentOrder, puzzle.events, hints.length, onCommit, toast]);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader puzzleNumber={puzzle.puzzleNumber} isArchive={true} mode="order" />
      <main className="flex-1 py-16">
        <LayoutContainer className="flex max-w-3xl flex-col gap-6">
          <div className="mb-4">
            <Link
              href="/archive/order"
              className="text-muted-foreground hover:text-primary text-sm"
            >
              ← Back to Order Archive
            </Link>
          </div>
          <DocumentHeader
            puzzleNumber={puzzle.puzzleNumber}
            date={puzzle.date}
            events={puzzle.events}
          />
          <OrderEventList
            events={puzzle.events}
            ordering={currentOrder}
            onOrderingChange={handleOrderingChange}
            lockedPositions={lockedPositions}
            hintsByEvent={hintsByEvent}
          />
          <HintDisplay
            events={puzzle.events}
            hints={hints}
            onRequestHint={requestHint}
            disabledTypes={disabledHintTypes}
            pendingType={pendingHintType}
            error={hintError}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleCommit}>Submit</Button>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              Hints used: {hints.length}/3
            </p>
          </div>
        </LayoutContainer>
      </main>
      <Footer />
    </div>
  );
}

function findMovedEventId(oldOrder: string[], newOrder: string[]): string | null {
  for (let i = 0; i < oldOrder.length; i++) {
    if (oldOrder[i] !== newOrder[i]) {
      return newOrder[i];
    }
  }
  return null;
}

interface HintContext {
  currentOrder: string[];
  events: OrderEvent[];
  hints: OrderHint[];
  correctOrder: string[];
  puzzleSeed: number;
}

function createHintForType(type: HintType, context: HintContext): OrderHint {
  const { currentOrder, events, hints, correctOrder, puzzleSeed } = context;
  const seed = puzzleSeed;

  switch (type) {
    case "anchor": {
      const excludeEventIds = hints
        .filter((h) => h.type === "anchor")
        .map((h) => (h as Extract<OrderHint, { type: "anchor" }>).eventId);
      return generateAnchorHint(currentOrder, correctOrder, { seed, excludeEventIds });
    }
    case "relative": {
      const excludePairs = hints
        .filter((h) => h.type === "relative")
        .map((h) => {
          const relHint = h as Extract<OrderHint, { type: "relative" }>;
          return { earlierEventId: relHint.earlierEventId, laterEventId: relHint.laterEventId };
        });
      return generateRelativeHint(currentOrder, events, { seed, excludePairs });
    }
    case "bracket": {
      const excludeEventIds = hints
        .filter((h) => h.type === "bracket")
        .map((h) => (h as Extract<OrderHint, { type: "bracket" }>).eventId);
      return generateBracketHint(events, { seed, excludeEventIds });
    }
    default:
      throw new Error(`Unsupported hint type: ${type satisfies never}`);
  }
}
