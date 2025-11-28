import type { GolfScore, OrderAttempt } from "@/types/orderGameState";
import { getGolfTerm, getGolfEmoji } from "@/types/orderGameState";

// =============================================================================
// Golf Share Types
// =============================================================================

export interface GolfSharePayload {
  puzzleNumber: number;
  score: GolfScore;
  attempts: OrderAttempt[];
  url?: string;
}

// =============================================================================
// Golf Share Text Generation
// =============================================================================

/**
 * Generates golf-style share text.
 *
 * Example:
 * CHRONDLE ORDER #247
 * 🐦 Birdie! (3 strokes, Par 4)
 * ⬜🟩⬜🟩⬜⬜ → ⬜🟩🟩🟩⬜🟩 → 🟩🟩🟩🟩🟩🟩
 * https://www.chrondle.app
 */
export function generateGolfShareText(payload: GolfSharePayload): string {
  const { puzzleNumber, score, attempts, url } = payload;

  const term = getGolfTerm(score.relativeToPar);
  const emoji = getGolfEmoji(term);

  // Format the score line
  const termDisplay = formatTermDisplay(term, score);
  const strokeLabel = score.strokes === 1 ? "stroke" : "strokes";

  // Build attempt progression line
  const progressLine = attempts
    .map((attempt) => {
      return attempt.feedback.map((f) => (f === "correct" ? "🟩" : "⬜")).join("");
    })
    .join(" → ");

  let shareText = `CHRONDLE ORDER #${puzzleNumber}\n`;
  shareText += `${emoji} ${termDisplay} (${score.strokes} ${strokeLabel}, Par ${score.par})\n`;
  shareText += `${progressLine}\n\n`;
  shareText += url || "https://www.chrondle.app";

  return shareText;
}

function formatTermDisplay(term: string, score: GolfScore): string {
  switch (term) {
    case "hole-in-one":
      return "Hole in One!";
    case "eagle":
      return "Eagle!";
    case "birdie":
      return "Birdie!";
    case "par":
      return "Par";
    case "bogey":
      return "Bogey";
    case "double-bogey":
      return "Double Bogey";
    case "triple-bogey":
      return "Triple Bogey";
    case "over-par":
      return `+${score.relativeToPar}`;
    default:
      return term;
  }
}

/**
 * Copies golf-style share text to clipboard.
 */
export async function copyGolfShareTextToClipboard(payload: GolfSharePayload): Promise<void> {
  const shareText = generateGolfShareText(payload);

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
  const accuracyPercent = Math.round((score.correctPairs / score.totalPairs) * 100);

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
