"use client";

import { useCallback, useMemo, useRef } from "react";
import { useAuthState } from "@/hooks/data/useAuthState";
import { useOrderPuzzleData } from "@/hooks/data/useOrderPuzzleData";
import { useOrderProgress } from "@/hooks/data/useOrderProgress";
import { useOrderSession } from "@/hooks/useOrderSession";
import { deriveOrderGameState, type OrderDataSources } from "@/lib/deriveOrderGameState";
import {
  initializeOrderState,
  reduceOrderState,
  selectOrdering,
  type OrderEngineAction,
  type OrderEngineState,
} from "@/lib/order/engine";
import { mergeHints } from "@/lib/order/hintMerging";
import type { OrderGameState, OrderHint, OrderScore } from "@/types/orderGameState";

interface UseOrderGameReturn {
  gameState: OrderGameState;
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  takeHint: (hint: OrderHint) => void;
  commitOrdering: (score: OrderScore) => Promise<void>;
}

export function useOrderGame(puzzleNumber?: number, initialPuzzle?: unknown): UseOrderGameReturn {
  const puzzle = useOrderPuzzleData(puzzleNumber, initialPuzzle);
  const auth = useAuthState();
  const progress = useOrderProgress(auth.userId, puzzle.puzzle?.id ?? null);

  const baselineOrder = useMemo(
    () => puzzle.puzzle?.events.map((event) => event.id) ?? [],
    [puzzle.puzzle?.events],
  );

  // Compute correct chronological order for hint application
  const correctOrder = useMemo(
    () =>
      puzzle.puzzle
        ? [...puzzle.puzzle.events]
            .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
            .map((event) => event.id)
        : [],
    [puzzle.puzzle],
  );

  const session = useOrderSession(puzzle.puzzle?.id ?? null, baselineOrder, auth.isAuthenticated);

  const dataSources: OrderDataSources = useMemo(
    () => ({
      puzzle,
      auth,
      progress,
      session: session.state,
    }),
    [puzzle, auth, progress, session.state],
  );

  const gameState = useMemo(() => deriveOrderGameState(dataSources), [dataSources]);

  const serverHints = useMemo(
    () => (auth.isAuthenticated && progress.progress ? progress.progress.hints : []),
    [auth.isAuthenticated, progress.progress],
  );
  const mergedHints = useMemo(
    () => mergeHints(serverHints, session.state.hints),
    [serverHints, session.state.hints],
  );

  const engineContext = useMemo(() => ({ baseline: baselineOrder }), [baselineOrder]);

  const sessionOrderingRef = useRef(session.state.ordering);
  sessionOrderingRef.current = session.state.ordering;

  const runOrderReducer = useCallback(
    (ordering: string[], action: OrderEngineAction): OrderEngineState => {
      const baseState = initializeOrderState(engineContext, ordering, mergedHints);
      return reduceOrderState(engineContext, baseState, action);
    },
    [engineContext, mergedHints],
  );

  const reorderEvents = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) {
        return;
      }

      const ordering = sessionOrderingRef.current;
      if (
        fromIndex < 0 ||
        fromIndex >= ordering.length ||
        toIndex < 0 ||
        toIndex >= ordering.length
      ) {
        return;
      }

      const eventId = ordering[fromIndex];
      if (!eventId) {
        return;
      }

      const nextState = runOrderReducer(ordering, {
        type: "move",
        eventId,
        targetIndex: toIndex,
      });
      const nextOrdering = selectOrdering(nextState);

      if (!ordersMatch(ordering, nextOrdering)) {
        session.setOrdering(nextOrdering);
      }
    },
    [runOrderReducer, session],
  );

  const takeHint = useCallback(
    (hint: OrderHint) => {
      // Apply hint effect to ordering (anchor hints move events to correct position)
      const currentOrdering = sessionOrderingRef.current;

      const nextState = runOrderReducer(currentOrdering, {
        type: "apply-hint",
        hint,
        correctOrder,
      });
      const newOrdering = selectOrdering(nextState);

      // Update ordering if it changed
      if (!ordersMatch(currentOrdering, newOrdering)) {
        session.setOrdering(newOrdering);
      }

      // Add hint to history
      session.addHint(hint);
    },
    [session, correctOrder, runOrderReducer],
  );

  const commitOrdering = useCallback(
    async (score: OrderScore) => {
      session.markCommitted(score);
    },
    [session],
  );

  return useMemo(
    () => ({
      gameState,
      reorderEvents,
      takeHint,
      commitOrdering,
    }),
    [gameState, reorderEvents, takeHint, commitOrdering],
  );
}

function ordersMatch(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
