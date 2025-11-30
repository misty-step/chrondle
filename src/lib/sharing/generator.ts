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

    // Header: Chrondle #96
    const header = `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""}`;

    // Stats Block
    // 🏆 85/100
    // 💡 2 • 📏 15y
    const scoreLine = hasWon ? `🏆 ${totalScore}/100` : `❌ ${totalScore}/100`;
    const statsLine = `💡 ${hintsUsed} • 📏 ${widthYears}y`;

    return `${header}\n${scoreLine}\n${statsLine}\n\nchrondle.app`;
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: Game complete\nchrondle.app`;
  }
}
