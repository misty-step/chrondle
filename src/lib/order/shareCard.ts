/**
 * Order Mode Share Text Generator
 * Generates formatted text for sharing Order puzzle results (NYT Games style)
 */

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
 * Generates share text for Order mode.
 *
 * Example:
 * Chrondle: Order #247
 * ⬜🟩⬜🟩⬜⬜
 * ⬜🟩🟩🟩⬜🟩
 * 🟩🟩🟩🟩🟩🟩
 *
 * https://www.chrondle.app
 */
export function generateArchivalShareText(payload: ArchivalSharePayload): string {
  const { puzzleNumber, attempts, url } = payload;

  // Build attempt progression - each attempt on its own row
  const progressLines = attempts
    .map((attempt) => attempt.feedback.map((f) => (f === "correct" ? "🟩" : "⬜")).join(""))
    .join("\n");

  let shareText = `Chrondle: Order #${puzzleNumber}\n`;
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

/**
 * Generate hints visualization: 💡💡⬜ (Order has max 3 hints)
 */
function generateHintsBar(hintsUsed: number): string {
  const maxHints = 3;
  const used = Math.min(Math.max(0, hintsUsed), maxHints);
  return "💡".repeat(used) + "⬜".repeat(maxHints - used);
}

/**
 * Generates text-based share content in NYT Games style
 * @param payload - Share payload with results and score
 * @returns Formatted text ready for clipboard
 */
export function generateOrderShareText(payload: OrderSharePayload): string {
  const { puzzleNumber, results, score, url } = payload;

  // Header: Chrondle Order #96 5/6
  const header = `Chrondle Order #${puzzleNumber} ${score.correctPairs}/${score.totalPairs}`;

  // Results: ✓ ✗ ✓ ✓ ✗ ✓
  const resultLine = results.map((r) => (r === "correct" ? "✓" : "✗")).join(" ");

  // Hints: 💡💡⬜
  const hints = generateHintsBar(score.hintsUsed);

  // Build share text
  const cleanUrl = url?.replace(/^https?:\/\/(www\.)?/, "") || "chrondle.app";

  return `${header}\n\n${resultLine}\n${hints}\n\n${cleanUrl}`;
}

/**
 * Copies text-based share content to clipboard
 * @param payload - Share payload with results and score
 */
export async function copyOrderShareTextToClipboard(payload: OrderSharePayload): Promise<void> {
  const shareText = generateOrderShareText(payload);

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    throw new Error("Clipboard API unsupported");
  }

  await navigator.clipboard.writeText(shareText);
}
