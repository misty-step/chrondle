import type { Id } from "../../convex/_generated/dataModel";

// =============================================================================
// Game State Union
// =============================================================================

export type OrderGameState =
  | LoadingPuzzleState
  | LoadingAuthState
  | LoadingProgressState
  | ReadyState
  | CompletedState
  | ErrorState;

export interface LoadingPuzzleState {
  status: "loading-puzzle";
}

export interface LoadingAuthState {
  status: "loading-auth";
}

export interface LoadingProgressState {
  status: "loading-progress";
}

/**
 * Player is actively playing - can reorder events and submit attempts.
 */
export interface ReadyState {
  status: "ready";
  puzzle: OrderPuzzle;
  currentOrder: string[];
  attempts: OrderAttempt[];
}

/**
 * Player has solved the puzzle (all positions correct).
 */
export interface CompletedState {
  status: "completed";
  puzzle: OrderPuzzle;
  finalOrder: string[];
  correctOrder: string[];
  attempts: OrderAttempt[];
  score: AttemptScore;
}

export interface ErrorState {
  status: "error";
  error: string;
}

// =============================================================================
// Puzzle Structure
// =============================================================================

export interface OrderPuzzle {
  id: Id<"orderPuzzles">;
  date: string;
  puzzleNumber: number;
  events: OrderEvent[];
  seed: string;
}

export interface OrderEvent {
  id: string;
  year: number;
  text: string;
}

// =============================================================================
// Attempt Tracking
// =============================================================================

/**
 * A single attempt at ordering the events.
 * Tracks the ordering submitted and feedback received.
 */
export interface OrderAttempt {
  ordering: string[];
  feedback: PositionFeedback[];
  pairsCorrect: number;
  totalPairs: number;
  timestamp: number;
}

/**
 * Per-position feedback: was the event in the exact correct position?
 */
export type PositionFeedback = "correct" | "incorrect";

/**
 * Simple attempt-based scoring.
 */
export interface AttemptScore {
  /** Number of arrangements to solve */
  attempts: number;
}

// =============================================================================
// Legacy Types (deprecated, kept for migration)
// =============================================================================

/** @deprecated Use AttemptScore instead */
export interface OrderScore {
  totalScore: number;
  correctPairs: number;
  totalPairs: number;
  perfectPositions: number;
  hintsUsed: number;
}

/** @deprecated Hints removed in golf redesign */
export type OrderHint =
  | { type: "anchor"; eventId: string; position: number }
  | { type: "relative"; earlierEventId: string; laterEventId: string }
  | { type: "bracket"; eventId: string; yearRange: [number, number] };
