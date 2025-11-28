import { logger } from "@/lib/logger";
import { calculateGolfScore, DEFAULT_PAR, getCorrectOrder } from "@/lib/order/golfScoring";
import type { GolfScore, OrderAttempt, OrderGameState, OrderPuzzle } from "@/types/orderGameState";

// =============================================================================
// Data Source Types
// =============================================================================

/**
 * Orthogonal data sources required to derive the Order game state.
 * Each source is independent and can be loaded/updated separately.
 */
export interface OrderDataSources {
  puzzle: {
    puzzle: OrderPuzzle | null;
    isLoading: boolean;
    error: Error | null;
  };
  auth: {
    userId: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  progress: {
    progress: OrderProgressData | null;
    isLoading: boolean;
  };
  session: OrderSessionState;
}

/**
 * Authenticated user progress stored on the server (golf mode).
 */
export interface OrderProgressData {
  ordering: string[];
  attempts: OrderAttempt[];
  completedAt: number | null;
  score: GolfScore | null;
}

/**
 * Anonymous/local session state stored in localStorage (golf mode).
 */
export interface OrderSessionState {
  ordering: string[];
  attempts: OrderAttempt[];
  completedAt: number | null;
  score: GolfScore | null;
}

// =============================================================================
// State Derivation
// =============================================================================

/**
 * Pure function that derives the Order game state from orthogonal data sources.
 *
 * Golf Mode Rules:
 * - Players submit ordering attempts
 * - Each attempt shows feedback (correct/incorrect per position)
 * - Game completes when all 6 positions are correct
 * - Score = number of attempts (strokes)
 */
export function deriveOrderGameState(sources: OrderDataSources): OrderGameState {
  try {
    const { puzzle, auth, progress, session } = sources;

    // Loading sequence: puzzle -> auth -> progress
    if (puzzle.isLoading) {
      return { status: "loading-puzzle" };
    }

    if (puzzle.error) {
      return {
        status: "error",
        error: puzzle.error.message || "Failed to load Order puzzle",
      };
    }

    if (!puzzle.puzzle) {
      return { status: "error", error: "No Order puzzle available" };
    }

    if (auth.isLoading) {
      return { status: "loading-auth" };
    }

    if (auth.isAuthenticated && progress.isLoading) {
      return { status: "loading-progress" };
    }

    const orderPuzzle = puzzle.puzzle;
    const baselineOrder = orderPuzzle.events.map((event) => event.id);
    const correctOrder = getCorrectOrder(orderPuzzle.events);
    const par = DEFAULT_PAR;

    // Merge server + session state (prefer server for authenticated users)
    const resolvedState = resolveState(auth, progress.progress, session, baselineOrder);

    // Check completion status
    const isComplete = resolvedState.completedAt !== null;

    if (isComplete) {
      const score = resolvedState.score ?? calculateGolfScore(resolvedState.attempts, par);

      return {
        status: "completed",
        puzzle: orderPuzzle,
        finalOrder: resolvedState.ordering,
        correctOrder,
        attempts: resolvedState.attempts,
        score,
      };
    }

    return {
      status: "ready",
      puzzle: orderPuzzle,
      currentOrder: resolvedState.ordering,
      attempts: resolvedState.attempts,
      par,
    };
  } catch (error) {
    logger.error("Error deriving Order game state:", error);
    return {
      status: "error",
      error:
        error instanceof Error
          ? `Order state derivation failed: ${error.message}`
          : "Failed to calculate Order game state",
    };
  }
}

// =============================================================================
// State Resolution
// =============================================================================

interface ResolvedState {
  ordering: string[];
  attempts: OrderAttempt[];
  completedAt: number | null;
  score: GolfScore | null;
}

/**
 * Resolves the canonical state from server + session sources.
 * Server takes precedence for authenticated users.
 */
function resolveState(
  auth: OrderDataSources["auth"],
  serverProgress: OrderProgressData | null,
  session: OrderSessionState,
  baselineOrder: string[],
): ResolvedState {
  // For authenticated users with server progress, prefer server
  if (auth.isAuthenticated && serverProgress) {
    return {
      ordering: normalizeOrdering(serverProgress.ordering, baselineOrder),
      attempts: serverProgress.attempts,
      completedAt: serverProgress.completedAt,
      score: serverProgress.score,
    };
  }

  // Fall back to session state
  return {
    ordering: normalizeOrdering(session.ordering, baselineOrder),
    attempts: session.attempts,
    completedAt: session.completedAt,
    score: session.score,
  };
}

/**
 * Ensures ordering contains exactly the baseline event IDs.
 */
function normalizeOrdering(ordering: string[], baseline: string[]): string[] {
  if (!ordering.length) {
    return baseline;
  }

  const baselineSet = new Set(baseline);
  const seen = new Set<string>();
  const normalized: string[] = [];

  // Add valid IDs in order
  for (const id of ordering) {
    if (!seen.has(id) && baselineSet.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  // Add any missing IDs
  for (const id of baseline) {
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  }

  return normalized;
}
