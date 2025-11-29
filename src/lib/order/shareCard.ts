import type { AttemptScore, OrderAttempt } from "@/types/orderGameState";

// =============================================================================
// Archival Share Types
// =============================================================================

export interface ArchivalSharePayload {
  puzzleNumber: number;
  score: AttemptScore;
  attempts: OrderAttempt[];
  url?: string;
}

// =============================================================================
// Archival Share Text Generation
// =============================================================================

/**
 * Generates archival-style share text.
 *
 * Example:
 * CHRONDLE ORDER #247
 * 📋 3 attempts
 * ⬜🟩⬜🟩⬜⬜
 * ⬜🟩🟩🟩⬜🟩
 * 🟩🟩🟩🟩🟩🟩
 * https://www.chrondle.app
 */
export function generateArchivalShareText(payload: ArchivalSharePayload): string {
  const { puzzleNumber, score, attempts, url } = payload;

  const attemptLabel = score.attempts === 1 ? "attempt" : "attempts";

  // Build attempt progression - each attempt on its own row
  const progressLines = attempts
    .map((attempt) => attempt.feedback.map((f) => (f === "correct" ? "🟩" : "⬜")).join(""))
    .join("\n");

  let shareText = `CHRONDLE ORDER #${puzzleNumber}\n`;
  shareText += `📋 ${score.attempts} ${attemptLabel}\n`;
  shareText += `${progressLines}\n\n`;
  shareText += url || "https://www.chrondle.app";

  return shareText;
}

/**
 * Copies archival-style share text to clipboard.
 */
export async function copyArchivalShareTextToClipboard(
  payload: ArchivalSharePayload,
): Promise<void> {
  const shareText = generateArchivalShareText(payload);

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    throw new Error("Clipboard API unsupported");
  }

  await navigator.clipboard.writeText(shareText);
}

// =============================================================================
// Legacy Share Types (kept for backwards compatibility)
// =============================================================================

export type OrderShareResult = "correct" | "incorrect";

export interface OrderSharePayload {
  dateLabel: string;
  puzzleNumber: number;
  results: OrderShareResult[];
  score: {
    totalScore: number;
    correctPairs: number;
    totalPairs: number;
    hintsUsed: number;
  };
  url?: string;
}

export function generateOrderShareText(payload: OrderSharePayload): string {
  const { dateLabel, puzzleNumber, results, score, url } = payload;

  const emojiLine = results.map((r) => (r === "correct" ? "✓" : "✗")).join(" ");
  // Defensive guard: Graceful degradation if totalPairs is 0 (legacy backwards compatibility)
  const accuracyPercent =
    score.totalPairs === 0 ? 0 : Math.round((score.correctPairs / score.totalPairs) * 100);

  let shareText = `CHRONDLE ORDER #${puzzleNumber} · ${dateLabel}\n`;
  shareText += `${emojiLine}\n\n`;
  shareText += `🎯 ${accuracyPercent}% Accuracy\n`;
  shareText += `🔗 ${score.correctPairs}/${score.totalPairs} pairs · 💡 ${score.hintsUsed}/3 hints\n\n`;
  shareText += url || "https://www.chrondle.app";

  return shareText;
}

export async function copyOrderShareTextToClipboard(payload: OrderSharePayload): Promise<void> {
  const shareText = generateOrderShareText(payload);

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    throw new Error("Clipboard API unsupported");
  }

  await navigator.clipboard.writeText(shareText);
}
