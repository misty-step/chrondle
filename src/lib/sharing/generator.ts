/**
 * Social Sharing Content Generator
 * Generates formatted text for sharing game results (NYT Games style)
 */

import type { RangeGuess } from "@/types/range";
import { logger } from "@/lib/logger";

interface ShareTextOptions {
  targetYear?: number;
}

function getPrimaryRange(ranges: RangeGuess[]): RangeGuess | undefined {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return undefined;
  }
  return ranges[ranges.length - 1];
}

function generateHintsBar(hintsUsed: number): string {
  const maxHints = 6;
  const used = Math.min(Math.max(0, hintsUsed), maxHints);
  return "⬛".repeat(used) + "⬜".repeat(maxHints - used);
}

function getScoreEmoji(score: number, hasWon: boolean): string {
  if (!hasWon) return "🫠";
  if (score >= 100) return "🎯";
  if (score >= 90) return "🔥";
  if (score >= 80) return "⭐";
  if (score >= 70) return "😎";
  return "👍";
}

export function generateShareText(
  ranges: RangeGuess[],
  totalScore: number,
  hasWon: boolean,
  puzzleNumber?: number,
  _options: ShareTextOptions = {},
): string {
  try {
    if (
      !Array.isArray(ranges) ||
      ranges.length === 0 ||
      ranges.some((range) => typeof range.start !== "number")
    ) {
      logger.error("Invalid ranges passed to generateShareText");
      return "Chrondle share text generation failed";
    }

    const primaryRange = getPrimaryRange(ranges);
    if (!primaryRange) {
      return "Chrondle share text generation failed";
    }

    const hintsUsed = primaryRange.hintsUsed ?? 0;
    const widthYears = primaryRange.end - primaryRange.start + 1;
    const yearLabel = widthYears === 1 ? "year" : "years";

    // Header: Chrondle #96
    const header = `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""}`;

    // Range: 🗓️ 151 years
    const rangeLine = `Range: 🗓️ ${widthYears} ${yearLabel}`;

    // Hints: ⬛⬛⬜⬜⬜⬜
    const hintsLine = `Hints: ${generateHintsBar(hintsUsed)}`;

    // Score: 🎯 100/100
    const scoreEmoji = getScoreEmoji(totalScore, hasWon);
    const scoreLine = `Score: ${scoreEmoji} ${totalScore}/100`;

    return `${header}\n${rangeLine}\n${hintsLine}\n${scoreLine}\n\nchrondle.app`;
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: Game complete\nchrondle.app`;
  }
}
