"use client";

import { useState, useEffect, use, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { OrderEventList } from "@/components/order/OrderEventList";
import { DocumentHeader } from "@/components/order/DocumentHeader";
import { HintDisplay } from "@/components/order/HintDisplay";
import { OrderReveal } from "@/components/order/OrderReveal";
import { ArchiveErrorBoundary } from "@/components/ArchiveErrorBoundary";
import { logger } from "@/lib/logger";
import type { OrderEvent, OrderHint, OrderScore } from "@/types/orderGameState";
import { deriveLockedPositions } from "@/lib/order/engine";
import { generateAnchorHint, generateBracketHint, generateRelativeHint } from "@/lib/order/hints";
import { Button } from "@/components/ui/button";

// Re-implementing core Order Logic locally for archive to avoid hook complexity
// Ideally this should share code with useOrderGame, but for now we just want a working archive view

interface ArchiveOrderPuzzleContentProps {
  puzzleNumber: string;
}

type HintType = OrderHint["type"];

function ArchiveOrderPuzzleContent({
  puzzleNumber,
}: ArchiveOrderPuzzleContentProps): React.ReactElement {
  const parsedNumber = parseInt(puzzleNumber, 10);

  // Fetch Puzzle Data
  const puzzle = useQuery(api.orderPuzzles.getOrderPuzzleByNumber, { puzzleNumber: parsedNumber });

  // Fetch User's Play Data (if any)
  // We need to know if the user is logged in first to avoid errors?
  // The hook handles auth check internally or returns null
  // We can't easily get the userId here without Auth0/Clerk hooks,
  // so we'll rely on a slightly different pattern or just assume no play history for anonymous users in archive for now.
  // BETTER: The archive is primarily for replaying or viewing.
  // Let's just load the puzzle and let the user play it client-side.
  // Persistence is tricky in archive without full auth context setup.

  // For this iteration: Client-side only play for archive (no persistence)
  // UNLESS we are logged in.

  const [gameState, setGameState] = useState<{
    currentOrder: string[];
    hints: OrderHint[];
    isComplete: boolean;
    score: OrderScore | null;
  }>({
    currentOrder: [],
    hints: [],
    isComplete: false,
    score: null,
  });

  // Initialize state when puzzle loads
  useEffect(() => {
    if (puzzle && gameState.currentOrder.length === 0) {
      const shuffledIds = puzzle.events.map((e: OrderEvent) => e.id);
      setGameState((prev) => ({
        ...prev,
        currentOrder: shuffledIds,
      }));
    }
  }, [puzzle, gameState.currentOrder.length]);

  // Hint Logic
  const [pendingHintType, setPendingHintType] = useState<HintType | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  const correctOrder = useMemo(
    () =>
      puzzle
        ? [...puzzle.events]
            .sort((a: OrderEvent, b: OrderEvent) => a.year - b.year)
            .map((e: OrderEvent) => e.id)
        : [],
    [puzzle],
  );

  const requestHint = useCallback(
    (type: HintType) => {
      if (!puzzle || gameState.isComplete) return;

      setPendingHintType(type);
      setHintError(null);

      try {
        // Seed generation (simplified)
        const seed = 12345 + gameState.hints.length;

        let newHint: OrderHint;

        // Simple hint generation using the library functions
        // Note: We need to reconstruct the "context" object expected by the generators
        if (type === "anchor") {
          const exclude = gameState.hints.filter((h) => h.type === "anchor").map((h) => h.eventId);
          newHint = generateAnchorHint(gameState.currentOrder, correctOrder, {
            seed,
            excludeEventIds: exclude,
          });
        } else if (type === "relative") {
          const exclude = gameState.hints
            .filter((h) => h.type === "relative")
            .map((h) => ({ earlierEventId: h.earlierEventId, laterEventId: h.laterEventId }));
          newHint = generateRelativeHint(gameState.currentOrder, puzzle.events, {
            seed,
            excludePairs: exclude,
          });
        } else {
          // Bracket - simple selection
          const bracketed = new Set(
            gameState.hints.filter((h) => h.type === "bracket").map((h) => h.eventId),
          );
          const available = puzzle.events.filter((e: OrderEvent) => !bracketed.has(e.id));
          if (available.length === 0) throw new Error("No events left to bracket");
          const target = available[0]; // Simplest selection
          newHint = generateBracketHint(target);
        }

        setGameState((prev) => ({
          ...prev,
          hints: [...prev.hints, newHint],
        }));
      } catch (e) {
        setHintError("Could not generate hint");
        logger.error("Hint generation failed", e);
      } finally {
        setPendingHintType(null);
      }
    },
    [puzzle, gameState.currentOrder, gameState.hints, gameState.isComplete, correctOrder],
  );

  const handleSubmit = () => {
    if (!puzzle) return;

    // Calculate Score
    const n = puzzle.events.length;
    let correctPairs = 0;
    const totalPairs = (n * (n - 1)) / 2;
    const trueOrder = [...puzzle.events].sort((a, b) => a.year - b.year).map((e) => e.id);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = gameState.currentOrder[i];
        const b = gameState.currentOrder[j];
        if (trueOrder.indexOf(a) < trueOrder.indexOf(b)) {
          correctPairs++;
        }
      }
    }

    const score: OrderScore = {
      totalScore: correctPairs * 2,
      correctPairs,
      totalPairs,
      perfectPositions: 0, // Simplified
      hintsUsed: gameState.hints.length,
    };

    setGameState((prev) => ({
      ...prev,
      isComplete: true,
      score,
    }));
  };

  if (!puzzle) {
    return (
      <div className="text-muted-foreground flex min-h-screen items-center justify-center">
        Loading puzzle...
      </div>
    );
  }

  if (gameState.isComplete && gameState.score) {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader currentStreak={0} />
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
            events={puzzle.events}
            finalOrder={gameState.currentOrder}
            correctOrder={correctOrder}
            score={gameState.score}
            puzzleNumber={puzzle.puzzleNumber}
            onShare={() => {}} // Share disabled in archive for now
          />
        </main>
        <Footer />
      </div>
    );
  }

  const lockedPositions = deriveLockedPositions(gameState.hints);

  const hintsByEvent: Record<string, OrderHint[]> = {};
  gameState.hints.forEach((h) => {
    const id = h.type === "anchor" || h.type === "bracket" ? h.eventId : h.earlierEventId; // Simplified mapping
    if (!hintsByEvent[id]) hintsByEvent[id] = [];
    hintsByEvent[id].push(h);
  });

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader currentStreak={0} />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-6 sm:px-0">
        {/* Archive Nav */}
        <div className="flex items-center justify-between">
          <Link href="/archive/order" className="text-muted-foreground hover:text-primary text-sm">
            ← Back to Order Archive
          </Link>
          <span className="text-muted-foreground text-sm font-medium">Archive Mode (Practice)</span>
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
              hints={gameState.hints}
              onRequestHint={requestHint}
              disabledTypes={{
                anchor: gameState.hints.some((h) => h.type === "anchor"),
                relative: gameState.hints.some((h) => h.type === "relative"),
                bracket: gameState.hints.some((h) => h.type === "bracket"),
              }}
              pendingType={pendingHintType}
              error={hintError ?? undefined}
            />
          </div>

          <div className="flex-1 space-y-4">
            <div className="lg:hidden">
              <HintDisplay
                events={puzzle.events}
                hints={gameState.hints}
                onRequestHint={requestHint}
                disabledTypes={{
                  anchor: gameState.hints.some((h) => h.type === "anchor"),
                  relative: gameState.hints.some((h) => h.type === "relative"),
                  bracket: gameState.hints.some((h) => h.type === "bracket"),
                }}
                pendingType={pendingHintType}
                error={hintError ?? undefined}
              />
            </div>

            <section className="border-border bg-card shadow-warm rounded-xl border p-4 md:p-6">
              <OrderEventList
                events={puzzle.events}
                ordering={gameState.currentOrder}
                onOrderingChange={(newOrder) => {
                  // Find change
                  // This is a bit hacky because the list component is complex
                  // We just replace the whole state
                  setGameState((prev) => ({ ...prev, currentOrder: newOrder }));
                }}
                lockedPositions={lockedPositions}
                hintsByEvent={hintsByEvent}
              />
            </section>

            <Button
              onClick={handleSubmit}
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
