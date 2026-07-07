/**
 * Order mode share grammar: one 🟩/⬜ row per attempt — the arrangement
 * correctness mechanic, told as a progression toward the solved row.
 * Only position feedback is rendered; event content and years never appear.
 */

import type { AttemptScore, OrderAttempt } from "@/types/orderGameState";
import { composeShareText } from "./format";

export interface OrderSharePayload {
  puzzleNumber: number;
  score: AttemptScore;
  attempts: OrderAttempt[];
  url?: string;
}

export function generateOrderShareText(payload: OrderSharePayload): string {
  const { puzzleNumber, attempts, url } = payload;

  const progressLines = attempts.map((attempt) =>
    attempt.feedback.map((f) => (f === "correct" ? "🟩" : "⬜")).join(""),
  );

  return composeShareText({
    mode: "Order",
    puzzleNumber,
    body: progressLines,
    url,
  });
}
