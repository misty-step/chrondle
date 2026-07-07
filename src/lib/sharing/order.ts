/**
 * Order mode share text.
 *
 * Body is the attempt-progression grid (🟩 correct position / ⬜ incorrect
 * position, one row per attempt) — Order's mechanic is arrangement
 * correctness, and the grid is the most direct expression of that. Only
 * `feedback` (correct/incorrect per position) is ever read; event ids,
 * text, and years are never part of the payload, so there is nothing to
 * leak.
 */

import type { AttemptScore, OrderAttempt } from "@/types/orderGameState";
import { buildShareHeader, buildShareText, CHRONDLE_URL } from "./format";

export interface OrderShareInput {
  puzzleNumber: number;
  score: AttemptScore;
  attempts: OrderAttempt[];
  url?: string;
}

export function generateOrderShareText(payload: OrderShareInput): string {
  const { puzzleNumber, attempts, url } = payload;

  const rows = attempts.map((attempt) =>
    attempt.feedback.map((f) => (f === "correct" ? "🟩" : "⬜")).join(""),
  );

  const header = buildShareHeader("Order", puzzleNumber);
  return buildShareText(header, rows, url ?? CHRONDLE_URL);
}
