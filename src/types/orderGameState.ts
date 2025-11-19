import type { Id } from "../../convex/_generated/dataModel";

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

export interface ReadyState {
  status: "ready";
  puzzle: OrderPuzzle;
  currentOrder: string[];
  hints: OrderHint[];
}

export interface CompletedState {
  status: "completed";
  puzzle: OrderPuzzle;
  finalOrder: string[];
  correctOrder: string[];
  score: OrderScore;
  hints: OrderHint[];
}

export interface ErrorState {
  status: "error";
  error: string;
}

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

export type OrderHint =
  | { type: "anchor"; eventId: string; position: number }
  | { type: "relative"; earlierEventId: string; laterEventId: string }
  | { type: "bracket"; eventId: string; yearRange: [number, number] };

export interface OrderScore {
  totalScore: number;
  correctPairs: number;
  totalPairs: number;
  perfectPositions: number;
  hintsUsed: number;
}
