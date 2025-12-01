"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { createAttempt, calculateAttemptScore, isSolved } from "@/lib/order/attemptScoring";
import { assertConvexId } from "@/lib/validation";
import type { AttemptScore, OrderAttempt, OrderGameState } from "@/types/orderGameState";
import { logger } from "@/lib/logger";
import type { Toast } from "@/hooks/use-toast";

// =============================================================================
// Hook Interface
// =============================================================================

interface UseOrderGameReturn {
  /** Current game state (loading, ready, completed, error) */
  gameState: OrderGameState;
  /** Move an event from one position to another */
  reorderEvents: (fromIndex: number, toIndex: number) => void;
  /** Submit current ordering as an attempt; returns the attempt with feedback */
  submitAttempt: () => Promise<OrderAttempt | null>;
  /** True while submitting and persisting a winning attempt */
  isSubmitting: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useOrderGame(
  puzzleNumber?: number,
  initialPuzzle?: unknown,
  addToast?: (toast: Omit<Toast, "id">) => void,
): UseOrderGameReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const puzzle = useOrderPuzzleData(puzzleNumber, initialPuzzle);
  const auth = useAuthState();
  const progress = useOrderProgress(auth.userId, puzzle.puzzle?.id ?? null);

  const baselineOrder = useMemo(
    () => puzzle.puzzle?.events.map((event) => event.id) ?? [],
    [puzzle.puzzle?.events],
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

  const sessionOrderingRef = useRef(session.state.ordering);
  sessionOrderingRef.current = session.state.ordering;

  const sessionAttemptsRef = useRef(session.state.attempts);
  sessionAttemptsRef.current = session.state.attempts;

  // =========================================================================
  // Reorder Events (simplified - no locks from hints)
  // =========================================================================

  const reorderEvents = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const ordering = sessionOrderingRef.current;
      if (
        fromIndex < 0 ||
        fromIndex >= ordering.length ||
        toIndex < 0 ||
        toIndex >= ordering.length
      ) {
        return;
      }

      // Simple array reorder - no lock enforcement needed
      const newOrdering = [...ordering];
      const [moved] = newOrdering.splice(fromIndex, 1);
      newOrdering.splice(toIndex, 0, moved);

      session.setOrdering(newOrdering);
    },
    [session],
  );

  // =========================================================================
  // Server Persistence (internal, defined before submitAttempt)
  // =========================================================================

  const persistToServer = useCallback(
    async (
      finalAttempt: OrderAttempt,
      allAttempts: OrderAttempt[],
      score: AttemptScore,
    ): Promise<[boolean, null] | [null, MutationError]> => {
      const authCheck = checkSubmissionAuth(
        {
          isAuthenticated: auth.isAuthenticated,
          userId: auth.userId,
          isLoading: auth.isLoading,
        },
        puzzle.puzzle?.id ?? null,
        { gameMode: "order", action: "submitAttempt" },
      );

      if (authCheck.error) {
        logSubmissionAttempt("order", "submitAttempt", authCheck, "failure");
        return handleSubmissionError(authCheck.error);
      }

      // Anonymous: local-only
      if (authCheck.isAnonymous) {
        logSubmissionAttempt("order", "submitAttempt", authCheck, "success");
        return [true, null];
      }

      // Authenticated: persist to server
      if (!puzzle.puzzle || !auth.userId) {
        logger.error("[submitAttempt] Impossible state: authenticated but missing data");
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

      const result = await safeMutation(
        async () => {
          const puzzleId = assertConvexId(puzzle.puzzle!.id, "orderPuzzles");
          const userId = assertConvexId(auth.userId!, "users");

          await submitOrderPlayMutation({
            puzzleId,
            userId,
            ordering: finalAttempt.ordering,
            attempts: allAttempts,
            score: {
              attempts: score.attempts,
            },
          });
          return true;
        },
        {
          puzzleId: puzzle.puzzle.id,
          userId: auth.userId,
        },
      );

      logSubmissionAttempt("order", "submitAttempt", authCheck, result[0] ? "success" : "failure");
      return result;
    },
    [auth, puzzle.puzzle, submitOrderPlayMutation],
  );

  // =========================================================================
  // Submit Attempt
  // =========================================================================

  const submitAttempt = useCallback(async (): Promise<OrderAttempt | null> => {
    // Guard: prevent double-submit
    if (isSubmitting) {
      return null;
    }

    if (!puzzle.puzzle) {
      logger.error("[useOrderGame] Cannot submit attempt: no puzzle");
      return null;
    }

    setIsSubmitting(true);

    try {
      const ordering = sessionOrderingRef.current;
      const events = puzzle.puzzle.events;

      // Create the attempt with feedback
      const attempt = createAttempt(ordering, events);

      // Add attempt to session (for immediate UI feedback)
      session.addAttempt(attempt);

      // Check if solved
      if (isSolved(attempt)) {
        const allAttempts = [...sessionAttemptsRef.current, attempt];
        const score = calculateAttemptScore(allAttempts);

        // Persist to server FIRST (await result!)
        const [success, error] = await persistToServer(attempt, allAttempts, score);

        if (success) {
          // Only mark completed after server confirms persistence
          session.markCompleted(score);
        } else {
          // Show toast on failure - game stays playable for retry
          addToast?.({
            title: "Couldn't save result",
            description: error?.retryable
              ? "Your progress wasn't saved. Try submitting again."
              : "Something went wrong. Your local progress is preserved.",
            variant: "destructive",
          });
        }
      }

      return attempt;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, puzzle.puzzle, session, persistToServer, addToast]);

  return useMemo(
    () => ({
      gameState,
      reorderEvents,
      submitAttempt,
      isSubmitting,
    }),
    [gameState, reorderEvents, submitAttempt, isSubmitting],
  );
}
