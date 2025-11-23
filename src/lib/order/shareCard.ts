import type { OrderScore } from "../../types/orderGameState";

export type OrderShareResult = "correct" | "incorrect";

export interface OrderSharePayload {
  dateLabel: string;
  puzzleNumber: number;
  results: OrderShareResult[]; // length 6 (✓ / ✗)
  score: OrderScore;
  url?: string;
}

export function generateOrderShareText(payload: OrderSharePayload): string {
  const { puzzleNumber, results, score, url } = payload;

  // Convert results to emoji line
  const emojiLine = results.map((r) => (r === "correct" ? "🟩" : "🟥")).join("");
  const hintsLabel = score.hintsUsed === 1 ? "hint" : "hints";

  let shareText = `Chrondle Order #${puzzleNumber}\n`;
  shareText += `${score.correctPairs}/${score.totalPairs} pairs · ${score.hintsUsed} ${hintsLabel}\n\n`;
  shareText += `${emojiLine}\n\n`;
  shareText += url || "chrondle.app";

  return shareText;
}
