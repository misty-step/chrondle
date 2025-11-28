"use client";

import { useCallback, useMemo, useState } from "react";
import { OrderEventList } from "@/components/order/OrderEventList";
import { OrderInstructions } from "@/components/order/OrderInstructions";
import { AttemptHistory } from "@/components/order/AttemptFeedback";
import { GameCard } from "@/components/ui/GameCard";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { OrderAttempt, ReadyState, PositionFeedback } from "@/types/orderGameState";

interface OrderGameBoardProps {
  gameState: ReadyState;
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  submitAttempt: () => Promise<OrderAttempt | null>;
}

export function OrderGameBoard({ gameState, reorderEvents, submitAttempt }: OrderGameBoardProps) {
  const { puzzle, currentOrder, attempts, par } = gameState;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get feedback from last attempt to show on cards
  const lastAttemptFeedback = useMemo((): PositionFeedback[] | undefined => {
    if (attempts.length === 0) return undefined;

    const lastAttempt = attempts[attempts.length - 1];

    // Map feedback to current ordering positions
    // We need to find where each event in the current order was in the last attempt
    const feedbackMap = new Map<string, PositionFeedback>();
    lastAttempt.ordering.forEach((eventId, idx) => {
      feedbackMap.set(eventId, lastAttempt.feedback[idx]);
    });

    // Return feedback for current order
    return currentOrder.map((eventId) => feedbackMap.get(eventId) ?? "incorrect");
  }, [attempts, currentOrder]);

  // Clear feedback when user makes changes (ordering differs from last attempt)
  const orderingChanged = useMemo(() => {
    if (attempts.length === 0) return false;
    const lastOrdering = attempts[attempts.length - 1].ordering;
    return !ordersMatch(currentOrder, lastOrdering);
  }, [attempts, currentOrder]);

  const displayFeedback = orderingChanged ? undefined : lastAttemptFeedback;

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

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await submitAttempt();
    } finally {
      setIsSubmitting(false);
    }
  }, [submitAttempt]);

  const strokesLabel = attempts.length === 1 ? "stroke" : "strokes";
  const buttonText =
    attempts.length === 0 ? "Check Order" : `Check Again (${attempts.length} ${strokesLabel})`;

  return (
    <div className="flex w-full flex-col gap-6">
      <OrderInstructions
        puzzleNumber={puzzle.puzzleNumber}
        events={puzzle.events}
        par={par}
        strokes={attempts.length}
      />

      {/* Attempt History - shows feedback from previous attempts */}
      {attempts.length > 0 && <AttemptHistory attempts={attempts} par={par} />}

      {/* Main Column */}
      <div className="space-y-4">
        {/* The Board */}
        <GameCard as="section" padding="default">
          <OrderEventList
            events={puzzle.events}
            ordering={currentOrder}
            onOrderingChange={handleOrderingChange}
            feedback={displayFeedback}
          />
        </GameCard>

        <SubmitButton onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Checking..." : buttonText}
        </SubmitButton>
      </div>
    </div>
  );
}

// Helpers

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

function ordersMatch(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
