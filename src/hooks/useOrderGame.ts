"use client";

import { useCallback, useMemo, useRef } from "react";
import { api } from "../../convex/_generated/api";
import { useAuthState } from "@/hooks/data/useAuthState";
import { useOrderPuzzleData } from "@/hooks/data/useOrderPuzzleData";
import { useOrderProgress } from "@/hooks/data/useOrderProgress";
import { useOrderSession } from "@/hooks/useOrderSession";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
import { safeMutation, type MutationError } from "@/observability/mutationErrorAdapter";
import {
  checkSubmissionAuth,
  handleSubmissionError,
  logSubmissionAttempt,
} from "@/lib/gameSubmission";
import { deriveOrderGameState, type OrderDataSources } from "@/lib/deriveOrderGameState";
import {
  initializeOrderState,
  reduceOrderState,
  selectOrdering,
  type OrderEngineAction,
  type OrderEngineState,
} from "@/lib/order/engine";
import { mergeHints, serializeHint } from "@/lib/order/hintMerging";
import { assertConvexId } from "@/lib/validation";
import type { OrderGameState, OrderHint, OrderScore } from "@/types/orderGameState";
import { logger } from "@/lib/logger";

interface UseOrderGameReturn {
  gameState: OrderGameState;
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  takeHint: (hint: OrderHint) => void;
  commitOrdering: (score: OrderScore) => Promise<[boolean, null] | [null, MutationError]>;
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

  const submitOrderPlayMutation = useMutationWithRetry(api.orderPuzzles.submitOrderPlay, {
    maxRetries: 3,
    baseDelayMs: 800,
    onRetry: (attempt, error) => {
      logger.error(
        `[useOrderGame] Retrying submitOrderPlay (attempt ${attempt}/3):`,
        error.message,
      );
    },
  });

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
    async (score: OrderScore): Promise<[boolean, null] | [null, MutationError]> => {
      const orderingForCommit =
        sessionOrderingRef.current && sessionOrderingRef.current.length
          ? sessionOrderingRef.current
          : baselineOrder;

      // Optimistic update - mark as committed immediately for UI responsiveness
      session.markCommitted(score);

      // Check authentication state and determine if we can persist
      const authCheck = checkSubmissionAuth(
        {
          isAuthenticated: auth.isAuthenticated,
          userId: auth.userId,
          isLoading: auth.isLoading,
        },
        puzzle.puzzle?.id ?? null,
        { gameMode: "order", action: "commitOrdering" },
      );

      // Handle auth edge case: authenticated but userId null
      // This is the bug we're fixing - we used to return [true, null] here!
      if (authCheck.error) {
        logSubmissionAttempt("order", "commitOrdering", authCheck, "failure");
        return handleSubmissionError(authCheck.error);
      }

      // Anonymous users: local-only gameplay, no server persistence
      if (authCheck.isAnonymous) {
        logSubmissionAttempt("order", "commitOrdering", authCheck, "success");
        return [true, null];
      }

      // Fully authenticated: persist to server
      // At this point we know puzzle.puzzle and auth.userId are non-null
      // because checkSubmissionAuth returned canPersist: true
      if (!puzzle.puzzle || !auth.userId) {
        // This should never happen due to checkSubmissionAuth, but TypeScript needs it
        logger.error("[commitOrdering] Impossible state: canPersist true but missing data");
        return [
          null,
          {
            code: "UNKNOWN" as const,
            message: "An unexpected error occurred. Please try again.",
            retryable: true,
            originalError: new Error("Impossible auth state"),
          },
        ];
      }

      const currentPuzzleId = puzzle.puzzle.id;
      const currentUserId = auth.userId;

      const result = await safeMutation(
        async () => {
          const puzzleId = assertConvexId(currentPuzzleId, "orderPuzzles");
          const userId = assertConvexId(currentUserId, "users");
          const serializedHints = mergedHints.map(serializeHint);
          const clientScore = {
            totalScore: score.totalScore,
            correctPairs: score.correctPairs,
            totalPairs: score.totalPairs,
            hintMultiplier: 1,
          };

          await submitOrderPlayMutation({
            puzzleId,
            userId,
            ordering: orderingForCommit,
            hints: serializedHints,
            clientScore,
          });
          return true;
        },
        {
          puzzleId: currentPuzzleId,
          userId: currentUserId,
        },
      );

      // Log submission outcome
      logSubmissionAttempt("order", "commitOrdering", authCheck, result[0] ? "success" : "failure");

      return result;
    },
    [auth, baselineOrder, mergedHints, puzzle, session, submitOrderPlayMutation],
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
