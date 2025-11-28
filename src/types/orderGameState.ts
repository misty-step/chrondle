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
  par: number;
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
  score: GolfScore;
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
// Golf Scoring System
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
 * Golf-style scoring: strokes (attempts) relative to par.
 */
export interface GolfScore {
  /** Number of attempts to solve (1 = hole-in-one) */
  strokes: number;
  /** Expected number of attempts (e.g., 4) */
  par: number;
  /** strokes - par: negative is good (-2 = eagle), positive is over par */
  relativeToPar: number;
}

// =============================================================================
// Golf Terminology Helpers
// =============================================================================

export type GolfTerm =
  | "hole-in-one"
  | "eagle"
  | "birdie"
  | "par"
  | "bogey"
  | "double-bogey"
  | "triple-bogey"
  | "over-par";

/**
 * Maps relative-to-par score to golf terminology.
 */
export function getGolfTerm(relativeToPar: number): GolfTerm {
  if (relativeToPar <= -3) return "hole-in-one"; // 1 stroke on par 4
  if (relativeToPar === -2) return "eagle";
  if (relativeToPar === -1) return "birdie";
  if (relativeToPar === 0) return "par";
  if (relativeToPar === 1) return "bogey";
  if (relativeToPar === 2) return "double-bogey";
  if (relativeToPar === 3) return "triple-bogey";
  return "over-par";
}

/**
 * Returns emoji for golf term.
 */
export function getGolfEmoji(term: GolfTerm): string {
  switch (term) {
    case "hole-in-one":
      return "🏆";
    case "eagle":
      return "🦅";
    case "birdie":
      return "🐦";
    case "par":
      return "⛳";
    case "bogey":
    case "double-bogey":
    case "triple-bogey":
    case "over-par":
      return "🏌️";
  }
}

// =============================================================================
// Legacy Types (deprecated, kept for migration)
// =============================================================================

/** @deprecated Use GolfScore instead */
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
