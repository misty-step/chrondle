"use client";

import { useState, useCallback, useMemo } from "react";
import { DocumentHeader } from "@/components/order/DocumentHeader";
import { HintDisplay } from "@/components/order/HintDisplay";
import { OrderEventList } from "@/components/order/OrderEventList";
import { OrderInstructions } from "@/components/order/OrderInstructions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import type { OrderEvent, ReadyState, OrderHint, OrderScore } from "@/types/orderGameState";
import type { MutationError } from "@/observability/mutationErrorAdapter";
import { deriveLockedPositions } from "@/lib/order/engine";
import { calculateOrderScore } from "@/lib/order/scoring";
import { generateAnchorHint, generateBracketHint, generateRelativeHint } from "@/lib/order/hints";
import { hashHintContext } from "@/lib/order/hashHintContext";

type HintType = OrderHint["type"];

interface OrderGameBoardProps {
  gameState: ReadyState;
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  takeHint: (hint: OrderHint) => void;
  commitOrdering: (score: OrderScore) => Promise<[boolean, null] | [null, MutationError]>;
}

export function OrderGameBoard({
  gameState,
  reorderEvents,
  takeHint,
  commitOrdering,
}: OrderGameBoardProps) {
  const { addToast } = useToast();
  const { puzzle, currentOrder, hints } = gameState;

  const [pendingHintType, setPendingHintType] = useState<HintType | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  // Derived state
  const correctOrder = useMemo(
    () =>
      puzzle.events
        .slice()
        .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
        .map((e) => e.id),
    [puzzle.events],
  );

  const puzzleSeed = useMemo(() => hashHintContext([puzzle.seed]), [puzzle.seed]);

  const lockedPositions = useMemo(() => deriveLockedPositions(hints), [hints]);

  const hintsByEvent = useMemo(() => {
    return hints.reduce(
      (acc, hint) => {
        const eventId =
          hint.type === "anchor" || hint.type === "bracket"
            ? hint.eventId
            : hint.type === "relative"
              ? hint.earlierEventId
              : null;
        if (eventId) {
          acc[eventId] = acc[eventId] || [];
          acc[eventId].push(hint);
        }
        return acc;
      },
      {} as Record<string, OrderHint[]>,
    );
  }, [hints]);

  const disabledHintTypes = useMemo(
    () => ({
      anchor: hints.some((h) => h.type === "anchor"),
      relative: hints.some((h) => h.type === "relative"),
      bracket: hints.some((h) => h.type === "bracket"),
    }),
    [hints],
  );

  // Handlers
  const handleOrderingChange = useCallback(
    (nextOrdering: string[], movedId?: string) => {
      const resolvedId = movedId ?? findMovedEventId(currentOrder, nextOrdering);
      if (!resolvedId) return;

      const fromIndex = currentOrder.indexOf(resolvedId);
      const toIndex = nextOrdering.indexOf(resolvedId);

      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        reorderEvents(fromIndex, toIndex);
      }
    },
    [currentOrder, reorderEvents],
  );

  const requestHint = useCallback(
    (type: HintType) => {
      if (pendingHintType || disabledHintTypes[type]) return;

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
    const [_success, error] = await commitOrdering(score);

    if (error) {
      addToast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
        actionLabel: error.retryable ? "Retry" : undefined,
        onAction: error.retryable ? handleCommit : undefined,
      });
    }
  }, [currentOrder, puzzle.events, hints.length, commitOrdering, addToast]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-4">
        <OrderInstructions />
        <DocumentHeader
          puzzleNumber={puzzle.puzzleNumber}
          date={puzzle.date}
          events={puzzle.events}
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row-reverse">
        {/* Sidebar (Hints) */}
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

        {/* Main Column */}
        <div className="flex-1 space-y-4">
          {/* Mobile Hints */}
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

          {/* The Board */}
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
            type="button"
            onClick={handleCommit}
            size="lg"
            className="relative z-10 w-full rounded-full text-base font-semibold shadow-lg"
          >
            Submit My Timeline
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helpers (copied from OrderGameIsland, moved here to be shared)

function findMovedEventId(previous: string[], next: string[]): string | null {
  if (previous.length !== next.length) return null;
  const previousPositions = new Map(previous.map((id, idx) => [id, idx]));
  const nextPositions = new Map(next.map((id, idx) => [id, idx]));

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

  const stateSeed = hashHintContext([puzzleSeed, type, currentOrder.join("-"), hints.length]);

  switch (type) {
    case "anchor": {
      const excludeEventIds = hints
        .filter((h) => h.type === "anchor")
        .map((h) => (h as Extract<OrderHint, { type: "anchor" }>).eventId);
      return generateAnchorHint(currentOrder, correctOrder, {
        seed: stateSeed,
        excludeEventIds,
      });
    }
    case "relative": {
      const excludePairs = hints
        .filter((h) => h.type === "relative")
        .map((h) => ({
          earlierEventId: (h as Extract<OrderHint, { type: "relative" }>).earlierEventId,
          laterEventId: (h as Extract<OrderHint, { type: "relative" }>).laterEventId,
        }));
      return generateRelativeHint(currentOrder, events, {
        seed: stateSeed,
        excludePairs,
      });
    }
    case "bracket": {
      // Re-implement logic or import helper.
      // For now, simple random selection using deterministic seed logic
      // (Ideally this logic should be in a pure lib function, but putting it here to match Island behavior)
      const bracketedIds = new Set(
        hints
          .filter((h) => h.type === "bracket")
          .map((h) => (h as Extract<OrderHint, { type: "bracket" }>).eventId),
      );
      const available = events.filter((e) => !bracketedIds.has(e.id));
      // Fallback if all bracketed
      const candidates = available.length ? available : events;
      // Simple deterministic pick
      const index = Math.abs(stateSeed) % candidates.length;
      return generateBracketHint([candidates[index]]);
    }
    default:
      throw new Error(`Unsupported hint type: ${type}`);
  }
}
