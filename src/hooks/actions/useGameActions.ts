"use client";

import { useState, useCallback, useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import { DataSources } from "@/lib/deriveGameState";
import { useToast } from "@/hooks/use-toast";
import { assertConvexId, isConvexIdValidationError } from "@/lib/validation";
import {
  validateGuessSubmission,
  validateRangeSubmission,
  normalizeHintCount,
} from "@/lib/validation/rangeValidation";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
import { logger } from "@/lib/logger";
import { scoreRange } from "@/lib/scoring";
import type { HintCount, RangeGuess } from "@/types/range";
import { checkSubmissionAuth, logSubmissionAttempt } from "@/lib/gameSubmission";

/**
 * Return type for the useGameActions hook
 */
export interface UseGameActionsReturn {
  submitGuess: (guess: number) => Promise<boolean>;
  submitRange: (input: { start: number; end: number; hintsUsed: number }) => Promise<boolean>;
  resetGame: () => void;
  isSubmitting: boolean;
}

/**
 * Hook for all game mutations with optimistic updates
 *
 * This hook provides actions for submitting guesses and resetting the game.
 * It implements optimistic updates for instant feedback and handles errors gracefully.
 *
 * @param sources - Data sources from the orthogonal hooks
 * @returns Object containing game action functions and submission state
 *
 * @example
 * const { submitGuess, resetGame, isSubmitting } = useGameActions(sources);
 *
 * // Submit a guess with optimistic update
 * const success = await submitGuess(1969);
 * if (success) {
 *   logger.debug("Guess submitted successfully");
 * }
 *
 * // Reset the game (clears session only)
 * resetGame();
 */
export function useGameActions(sources: DataSources): UseGameActionsReturn {
  const { puzzle, auth, session } = sources;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toastContext = useToast();

  // Convex mutation for submitting guesses with retry logic
  const submitGuessMutation = useMutationWithRetry(api.puzzles.submitGuess, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      logger.error(`[useGameActions] Retrying submitGuess (attempt ${attempt}/3):`, error.message);
      // Optionally show a toast to the user about the retry
      if (attempt === 3 && "addToast" in toastContext) {
        toastContext.addToast({
          title: "Connection issues",
          description: "Having trouble connecting to the server. Retrying...",
          variant: "default",
        });
      }
    },
  });

  const submitRangeMutation = useMutationWithRetry(api.puzzles.submitRange, {
    maxRetries: 3,
    baseDelayMs: 1000,
    onRetry: (attempt, error) => {
      logger.error(`[useGameActions] Retrying submitRange (attempt ${attempt}/3):`, error.message);
      if (attempt === 3 && "addToast" in toastContext) {
        toastContext.addToast({
          title: "Connection issues",
          description: "Having trouble connecting to the server. Retrying...",
          variant: "default",
        });
      }
    },
  });

  /**
   * Submit a guess with optimistic updates
   * Adds to session immediately for instant feedback
   * Persists to server if authenticated
   */
  const submitGuess = useCallback(
    async (guess: number): Promise<boolean> => {
      // Validate inputs
      if (!puzzle.puzzle) {
        if ("addToast" in toastContext) {
          toastContext.addToast({
            title: "Error",
            description: "No puzzle loaded",
            variant: "destructive",
          });
        }
        return false;
      }

      // Validate guess using extracted pure function
      const guessValidation = validateGuessSubmission(guess, session.sessionGuesses.length);
      if (!guessValidation.valid) {
        if ("addToast" in toastContext) {
          const error = guessValidation.errors[0];
          toastContext.addToast({
            title: error.field === "guess" ? "Invalid Year" : "No Guesses Remaining",
            description: error.message,
            variant: "destructive",
          });
        }
        return false;
      }

      // Prevent double-submission
      if (isSubmitting) {
        return false;
      }

      // Optimistic update - add to session immediately for instant feedback
      session.addGuess(guess);

      // Check authentication state and determine if we can persist
      const authCheck = checkSubmissionAuth(
        {
          isAuthenticated: auth.isAuthenticated,
          userId: auth.userId,
          isLoading: auth.isLoading,
        },
        puzzle.puzzle?.id ?? null,
        { gameMode: "classic", action: "submitGuess" },
      );

      // Handle auth edge case: authenticated but userId null
      if (authCheck.error) {
        logSubmissionAttempt("classic", "submitGuess", authCheck, "failure");

        if ("addToast" in toastContext) {
          toastContext.addToast({
            title: "Authentication Error",
            description: authCheck.error.message,
            variant: "destructive",
          });
        }

        // Don't return success for auth edge case - this is the bug we're fixing
        return false;
      }

      // Anonymous users: local-only gameplay, no server persistence
      if (authCheck.isAnonymous) {
        logSubmissionAttempt("classic", "submitGuess", authCheck, "success");
        return true;
      }

      // Fully authenticated: persist to server
      setIsSubmitting(true);

      try {
        // At this point we know puzzle.puzzle and auth.userId are non-null
        // because checkSubmissionAuth returned canPersist: true
        if (!puzzle.puzzle || !auth.userId) {
          logger.error("[submitGuess] Impossible state: canPersist true but missing data");
          return false;
        }

        // Validate and assert IDs with proper error handling
        const validPuzzleId = assertConvexId(puzzle.puzzle.id, "puzzles");
        const validUserId = assertConvexId(auth.userId, "users");

        await submitGuessMutation({
          puzzleId: validPuzzleId,
          userId: validUserId,
          guess,
        });

        // Success - guess is already in session from optimistic update
        logSubmissionAttempt("classic", "submitGuess", authCheck, "success");
        return true;
      } catch (error) {
        // Check if it's a validation error
        if (isConvexIdValidationError(error)) {
          logger.error("Invalid ID format detected:", error.id, "for type:", error.type);

          if ("addToast" in toastContext) {
            toastContext.addToast({
              title: "Authentication Error",
              description: "There was an issue with your user session. Please refresh the page.",
              variant: "destructive",
            });
          }

          logSubmissionAttempt("classic", "submitGuess", authCheck, "failure");
          // Still return true to keep the guess in session
          return true;
        }

        // Other errors - keep the guess in session for eventual consistency
        // The guess stays in the session, allowing the user to see it
        // and it will be merged properly when the page refreshes
        logger.error("Failed to persist guess to server:", error);

        if ("addToast" in toastContext) {
          toastContext.addToast({
            title: "Connection Issue",
            description: "Your guess was saved locally but couldn't sync to the server",
            variant: "destructive",
          });
        }

        logSubmissionAttempt("classic", "submitGuess", authCheck, "failure");
        // Return true because the guess was added to session successfully
        // This maintains eventual consistency - the guess will sync later
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      puzzle.puzzle,
      auth.isAuthenticated,
      auth.userId,
      auth.isLoading,
      session,
      isSubmitting,
      submitGuessMutation,
      toastContext,
    ],
  );

  const submitRange = useCallback(
    async ({ start, end, hintsUsed }: { start: number; end: number; hintsUsed: number }) => {
      if (!puzzle.puzzle) {
        if ("addToast" in toastContext) {
          toastContext.addToast({
            title: "Error",
            description: "No puzzle loaded",
            variant: "destructive",
          });
        }
        return false;
      }

      // Validate range using extracted pure function
      const rangeValidation = validateRangeSubmission(start, end);
      if (!rangeValidation.valid) {
        if ("addToast" in toastContext) {
          const error = rangeValidation.errors[0];
          const title =
            error.field === "width" && error.message.includes("narrower")
              ? "Range Too Wide"
              : "Invalid Range";
          toastContext.addToast({
            title,
            description: error.message,
            variant: "destructive",
          });
        }
        return false;
      }

      if (isSubmitting) {
        return false;
      }

      const hintLevel = normalizeHintCount(hintsUsed) as HintCount;
      const optimisticRange: RangeGuess = {
        start,
        end,
        hintsUsed: hintLevel,
        score: scoreRange(start, end, puzzle.puzzle.targetYear, 0, hintLevel),
        timestamp: Date.now(),
      };

      session.addRange?.(optimisticRange);

      // Check authentication state and determine if we can persist
      const authCheck = checkSubmissionAuth(
        {
          isAuthenticated: auth.isAuthenticated,
          userId: auth.userId,
          isLoading: auth.isLoading,
        },
        puzzle.puzzle?.id ?? null,
        { gameMode: "classic", action: "submitRange" },
      );

      // Handle auth edge case: authenticated but userId null
      if (authCheck.error) {
        logSubmissionAttempt("classic", "submitRange", authCheck, "failure");

        if ("addToast" in toastContext) {
          toastContext.addToast({
            title: "Authentication Error",
            description: authCheck.error.message,
            variant: "destructive",
          });
        }

        // Don't return success for auth edge case - this is the bug we're fixing
        session.removeLastRange?.();
        return false;
      }

      // Anonymous users: local-only gameplay, no server persistence
      if (authCheck.isAnonymous) {
        logSubmissionAttempt("classic", "submitRange", authCheck, "success");
        return true;
      }

      // Fully authenticated: persist to server
      // At this point we know puzzle.puzzle and auth.userId are non-null
      if (!puzzle.puzzle || !auth.userId) {
        logger.error("[submitRange] Impossible state: canPersist true but missing data");
        session.removeLastRange?.();
        return false;
      }

      setIsSubmitting(true);

      try {
        const validPuzzleId = assertConvexId(puzzle.puzzle.id, "puzzles");
        const validUserId = assertConvexId(auth.userId, "users");

        const result = await submitRangeMutation({
          puzzleId: validPuzzleId,
          userId: validUserId,
          start,
          end,
          hintsUsed: hintLevel,
        });

        if (result?.range) {
          session.replaceLastRange?.({
            ...optimisticRange,
            ...result.range,
            hintsUsed: result.range.hintsUsed as HintCount,
          });
        }

        logSubmissionAttempt("classic", "submitRange", authCheck, "success");
        return true;
      } catch (error) {
        session.removeLastRange?.();
        logSubmissionAttempt("classic", "submitRange", authCheck, "failure");

        if (isConvexIdValidationError(error)) {
          logger.error("Invalid ID format detected:", error.id, "for type:", error.type);
          if ("addToast" in toastContext) {
            toastContext.addToast({
              title: "Authentication Error",
              description: "There was an issue with your user session. Please refresh the page.",
              variant: "destructive",
            });
          }
          return false;
        }

        logger.error("Failed to persist range to server:", error);
        if ("addToast" in toastContext) {
          toastContext.addToast({
            title: "Connection Issue",
            description: "Your range was saved locally but couldn't sync to the server",
            variant: "destructive",
          });
        }

        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      puzzle.puzzle,
      auth.isAuthenticated,
      auth.userId,
      auth.isLoading,
      session,
      isSubmitting,
      submitRangeMutation,
      toastContext,
    ],
  );

  /**
   * Reset the game by clearing session state only
   * Server state is preserved as historical record
   */
  const resetGame = useCallback(() => {
    // Clear session guesses only
    // Server state (if any) is preserved as historical record
    session.clearGuesses();
    session.clearRanges?.();

    // No need to reload puzzle or refetch data
    // The game state will automatically update through derivation
  }, [session]);

  // Memoize the return value to prevent object recreation on every render
  return useMemo(
    () => ({
      submitGuess,
      submitRange,
      resetGame,
      isSubmitting,
    }),
    [submitGuess, submitRange, resetGame, isSubmitting],
  );
}
