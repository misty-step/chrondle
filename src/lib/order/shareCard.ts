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
 * Chrondle: Order #247 2/3
 * ⬜🟩⬜🟩⬜⬜
 * 🟩🟩🟩🟩🟩🟩
 *
 * chrondle.app
 */
export function generateArchivalShareText(payload: ArchivalSharePayload): string {
  const { puzzleNumber, attempts, url } = payload;
  const maxAttempts = 3;

  // Build attempt progression - each attempt on its own row
  const progressLines = attempts
    .map((attempt) => attempt.feedback.map((f) => (f === "correct" ? "🟩" : "⬜")).join(""))
    .join("\n");

  // Header with attempt count like Wordle "4/6"
  const attemptCount = attempts.length;
  let shareText = `Chrondle: Order #${puzzleNumber} ${attemptCount}/${maxAttempts}\n`;
  shareText += `${progressLines}\n\n`;
  shareText += url || "chrondle.app";

  return shareText;
}
