"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useOrderGame } from "@/hooks/useOrderGame";
import type { OrderEvent, OrderHint, OrderPuzzle, OrderScore } from "@/types/orderGameState";
import type { MutationError } from "@/observability/mutationErrorAdapter";
import { HintDisplay } from "@/components/order/HintDisplay";
import { OrderReveal } from "@/components/order/OrderReveal";
import { OrderEventList } from "@/components/order/OrderEventList";
import { DocumentHeader } from "@/components/order/DocumentHeader";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateAnchorHint, generateBracketHint, generateRelativeHint } from "@/lib/order/hints";
import { deriveLockedPositions } from "@/lib/order/engine";
import { calculateOrderScore } from "@/lib/order/scoring";
import { generateOrderShareText, type OrderShareResult } from "@/lib/order/shareCard";
import { useShare } from "@/hooks/useShare";
import { logger } from "@/lib/logger";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";

type HintType = OrderHint["type"];

interface ArchiveOrderPuzzleContentProps {
  puzzleNumber: string;
}

function ArchiveOrderPuzzleContent({
  puzzleNumber,
}: ArchiveOrderPuzzleContentProps): React.ReactElement {
  const parsedNumber = parseInt(puzzleNumber, 10);
  const { gameState, reorderEvents, takeHint, commitOrdering } = useOrderGame(parsedNumber);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const { share } = useShare({
    onSuccess: () => setShareFeedback("Shared!"),
    onError: () => setShareFeedback("Share failed"),
  });

  if (gameState.status === "loading-puzzle") {
    return renderShell("Loading Order puzzle…");
  }

  if (gameState.status === "loading-auth" || gameState.status === "loading-progress") {
    return renderShell("Preparing your Order session…");
  }

  if (gameState.status === "error") {
    return renderShell(`Something went wrong: ${gameState.error}`);
  }

  if (gameState.status === "completed") {
    const handleShare = async () => {
      const results: OrderShareResult[] = gameState.correctOrder.map((id, idx) =>
        gameState.finalOrder[idx] === id ? "correct" : "incorrect",
      );

      const text = generateOrderShareText({
        dateLabel: gameState.puzzle.date,
        puzzleNumber: gameState.puzzle.puzzleNumber,
        results,
        score: gameState.score,
      });

      await share(text);
    };

    return (
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader puzzleNumber={gameState.puzzle.puzzleNumber} isArchive={true} />
        <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-6 py-16 sm:px-0">
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
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <ReadyArchiveOrderGame
      puzzle={gameState.puzzle}
      currentOrder={gameState.currentOrder}
      hints={gameState.hints}
      reorderEvents={reorderEvents}
      takeHint={takeHint}
      onCommit={commitOrdering}
    />
  );
}

function renderShell(message: string) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-base">{message}</p>
    </main>
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

  const puzzleSeed = useMemo(() => {
    // Hash the puzzle seed for deterministic hint generation
    return hashHintContext([puzzle.seed]);
  }, [puzzle.seed]);

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
      <AppHeader puzzleNumber={puzzle.puzzleNumber} isArchive={true} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-6 sm:px-0">
        {/* Archive Nav */}
        <div className="flex items-center justify-between">
          <Link href="/archive/order" className="text-muted-foreground hover:text-primary text-sm">
            ← Back to Order Archive
          </Link>
          <span className="text-muted-foreground text-sm font-medium">Archive Mode</span>
        </div>

        <div className="space-y-4">
          <DocumentHeader
            puzzleNumber={puzzle.puzzleNumber}
            date={puzzle.date}
            events={puzzle.events}
          />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row-reverse">
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

          <div className="flex-1 space-y-4">
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

            <section className="border-border bg-card shadow-warm rounded-xl border p-4 md:p-6">
              <OrderEventList
                events={puzzle.events}
                ordering={currentOrder}
                onOrderingChange={handleOrderingChange}
                lockedPositions={lockedPositions}
                hintsByEvent={hintsByEvent}
              />
            </section>

            <Button
              onClick={handleCommit}
              size="lg"
              className="relative z-10 w-full rounded-full text-base font-semibold shadow-lg"
            >
              Submit My Timeline
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Helper function to find which event was moved
function findMovedEventId(oldOrder: string[], newOrder: string[]): string | null {
  for (let i = 0; i < oldOrder.length; i++) {
    if (oldOrder[i] !== newOrder[i]) {
      return newOrder[i];
    }
  }
  return null;
}

// Helper function to create hint (deterministic based on puzzle seed)
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
  const seed = puzzleSeed + hints.length;

  if (type === "anchor") {
    const excludeEventIds = hints
      .filter((h) => h.type === "anchor")
      .map((h) => (h as Extract<OrderHint, { type: "anchor" }>).eventId);
    return generateAnchorHint(currentOrder, correctOrder, { seed, excludeEventIds });
  }

  if (type === "relative") {
    const excludePairs = hints
      .filter((h) => h.type === "relative")
      .map((h) => {
        const relHint = h as Extract<OrderHint, { type: "relative" }>;
        return { earlierEventId: relHint.earlierEventId, laterEventId: relHint.laterEventId };
      });
    return generateRelativeHint(currentOrder, events, { seed, excludePairs });
  }

  // bracket
  const excludeEventIds = hints
    .filter((h) => h.type === "bracket")
    .map((h) => (h as Extract<OrderHint, { type: "bracket" }>).eventId);
  const available = events.filter((e) => !excludeEventIds.includes(e.id));
  if (available.length === 0) {
    throw new Error("No events available for bracket hint");
  }
  // Deterministic selection using seed
  const index = seed % available.length;
  return generateBracketHint(available[index]);
}

// Simple hash function for hint context
function hashHintContext(values: (string | number)[]): number {
  const str = values.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

interface PageProps {
  params: Promise<{ puzzleNumber: string }>;
}

export default function ArchiveOrderPuzzlePage({ params }: PageProps): React.ReactElement {
  const { puzzleNumber } = use(params);

  return (
    <ArchiveErrorBoundary>
      <ArchiveOrderPuzzleContent puzzleNumber={puzzleNumber} />
    </ArchiveErrorBoundary>
  );
}
