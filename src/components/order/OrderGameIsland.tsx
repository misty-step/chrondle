"use client";

import { useCallback, useMemo, useState } from "react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrderGame } from "@/hooks/useOrderGame";
import type { OrderEvent, OrderHint, OrderPuzzle, OrderScore } from "@/types/orderGameState";
import type { MutationError } from "@/observability/mutationErrorAdapter";
import { HintDisplay } from "@/components/order/HintDisplay";
import { OrderReveal } from "@/components/order/OrderReveal";
import { OrderEventList } from "@/components/order/OrderEventList";
import { DocumentHeader } from "@/components/order/DocumentHeader";
import { OrderInstructions } from "@/components/order/OrderInstructions";
import { AppHeader } from "@/components/AppHeader";
import { LayoutContainer } from "@/components/LayoutContainer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateAnchorHint, generateBracketHint, generateRelativeHint } from "@/lib/order/hints";
import { deriveLockedPositions } from "@/lib/order/engine";
import { calculateOrderScore } from "@/lib/order/scoring";
import { copyOrderShareTextToClipboard, type OrderShareResult } from "@/lib/order/shareCard";
import { logger } from "@/lib/logger";
import { hashHintContext } from "@/lib/order/hashHintContext";

interface OrderGameIslandProps {
  preloadedPuzzle: Preloaded<typeof api.orderPuzzles.getDailyOrderPuzzle>;
}

type HintType = OrderHint["type"];

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
      <div className="flex min-h-screen flex-col">
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
    <ReadyOrderGame
      puzzle={gameState.puzzle}
      currentOrder={gameState.currentOrder}
      hints={gameState.hints}
      reorderEvents={reorderEvents}
      takeHint={takeHint}
      onCommit={commitOrdering}
    />
  );
}

interface ReadyOrderGameProps {
  puzzle: OrderPuzzle;
  currentOrder: string[];
  hints: OrderHint[];
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  takeHint: (hint: OrderHint) => void;
  onCommit: (score: OrderScore) => Promise<[boolean, null] | [null, MutationError]>;
}

function ReadyOrderGame({
  puzzle,
  currentOrder,
  hints,
  reorderEvents,
  takeHint,
  onCommit,
}: ReadyOrderGameProps) {
  const toast = useToast();
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

  // Get locked positions from anchor hints (Map: eventId → locked position)
  const lockedPositions = useMemo(() => deriveLockedPositions(hints), [hints]);

  // Group hints by event ID for display on cards
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

  // Adapter function to convert optimistic ordering array into index-based updates
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
        setHintError("Unable to generate hint. Adjust your ordering and try again.");
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
    const [_success, error] = await onCommit(score);

    if (error && "addToast" in toast && toast.addToast) {
      toast.addToast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
        actionLabel: error.retryable ? "Retry" : undefined,
        onAction: error.retryable ? handleCommit : undefined,
      });
    }
  }, [currentOrder, puzzle.events, hints.length, onCommit, toast]);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* App Header - Consistent with Classic Mode */}
      <AppHeader puzzleNumber={puzzle.puzzleNumber} isArchive={false} mode="order" />

      {/* Main Content Area */}
      <main
        className="flex-1 py-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        <LayoutContainer className="flex w-full flex-col gap-6">
          <div className="space-y-4">
            {/* Instructions Banner */}
            <OrderInstructions />

            {/* Document Header - Archival catalog style */}
            <DocumentHeader
              puzzleNumber={puzzle.puzzleNumber}
              date={puzzle.date}
              events={puzzle.events}
            />
          </div>

          {/* Desktop: Side-by-side layout */}
          <div className="flex flex-col gap-6 lg:flex-row-reverse">
            {/* Hints Panel - Desktop sidebar */}
            <div className="hidden lg:block lg:w-[360px]">
              <HintDisplay
                events={puzzle.events}
                hints={hints}
                onRequestHint={requestHint}
                disabledTypes={disabledHintTypes}
                pendingType={pendingHintType}
                error={hintError ?? undefined}
              />
            </div>

            {/* Event List Section */}
            <div className="flex-1 space-y-4">
              {/* Mobile Hints - below headings, above events */}
              <div className="lg:hidden">
                <HintDisplay
                  events={puzzle.events}
                  hints={hints}
                  onRequestHint={requestHint}
                  disabledTypes={disabledHintTypes}
                  pendingType={pendingHintType}
                  error={hintError ?? undefined}
                />
              </div>

              {/* Event Cards */}
              <section className="border-border bg-card shadow-warm rounded-xl border p-4 md:p-6">
                <OrderEventList
                  events={puzzle.events}
                  ordering={currentOrder}
                  onOrderingChange={handleOrderingChange}
                  lockedPositions={lockedPositions}
                  hintsByEvent={hintsByEvent}
                />
              </section>

              {/* Submit Button - Below Timeline */}
              <Button
                type="button"
                onClick={handleCommit}
                size="lg"
                className="relative z-10 w-full rounded-full text-base font-semibold shadow-lg"
              >
                Submit My Timeline
              </Button>
            </div>
          </div>
        </LayoutContainer>
      </main>
    </div>
  );
}

function findMovedEventId(previous: string[], next: string[]): string | null {
  if (previous.length !== next.length) {
    return null;
  }

  const previousPositions = new Map<string, number>();
  const nextPositions = new Map<string, number>();

  previous.forEach((id, idx) => previousPositions.set(id, idx));
  next.forEach((id, idx) => nextPositions.set(id, idx));

  for (const id of previous) {
    if ((nextPositions.get(id) ?? -1) !== (previousPositions.get(id) ?? -1)) {
      return id;
    }
  }

  return null;
}

function createHintForType(
  type: HintType,
  context: {
    currentOrder: string[];
    events: OrderEvent[];
    hints: OrderHint[];
    correctOrder: string[];
    puzzleSeed: number;
  },
): OrderHint {
  const { currentOrder, events, hints, correctOrder, puzzleSeed } = context;
  if (!events.length) {
    throw new Error("Cannot generate hints without events.");
  }

  const stateSeed = hashHintContext([puzzleSeed, type, currentOrder.join("-"), hints.length]);

  switch (type) {
    case "anchor": {
      const excludeEventIds = hints
        .filter((hint) => hint.type === "anchor")
        .map((hint) => hint.eventId);
      return generateAnchorHint(currentOrder, correctOrder, {
        seed: stateSeed,
        excludeEventIds,
      });
    }
    case "relative": {
      const excludePairs = hints
        .filter((hint) => hint.type === "relative")
        .map((hint) => ({
          earlierEventId: hint.earlierEventId,
          laterEventId: hint.laterEventId,
        }));
      return generateRelativeHint(currentOrder, events, {
        seed: stateSeed,
        excludePairs,
      });
    }
    case "bracket": {
      const event = selectBracketEvent(currentOrder, events, hints, stateSeed);
      return generateBracketHint([event]);
    }
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported hint type: ${exhaustiveCheck}`);
    }
  }
}

function selectBracketEvent(
  currentOrder: string[],
  events: OrderEvent[],
  hints: OrderHint[],
  seed: number,
): OrderEvent {
  if (!events.length) {
    throw new Error("No events available for bracket hint.");
  }

  const bracketedIds = new Set(
    hints.filter((hint) => hint.type === "bracket").map((hint) => hint.eventId),
  );
  const chronological = [...events].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const orderIndex = new Map(currentOrder.map((id, index) => [id, index]));

  const candidatePool = chronological
    .filter((event) => !bracketedIds.has(event.id))
    .map((event, correctIndex) => ({
      event,
      displacement: Math.abs((orderIndex.get(event.id) ?? correctIndex) - correctIndex),
    }));

  const pool = candidatePool.length
    ? candidatePool
    : chronological.map((event, correctIndex) => ({
        event,
        displacement: Math.abs((orderIndex.get(event.id) ?? correctIndex) - correctIndex),
      }));

  const maxDisplacement = Math.max(...pool.map((item) => item.displacement));
  const topCandidates = pool.filter((item) => item.displacement === maxDisplacement);
  const normalizedSeed = Math.abs(seed);
  const index = topCandidates.length > 1 ? normalizedSeed % topCandidates.length : 0;
  return topCandidates[Math.max(0, index)].event;
}
