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

/**
 * Generate hints visualization: 💡💡⬜⬜⬜⬜
 */
function generateHintsBar(hintsUsed: number): string {
  const maxHints = 6;
  const used = Math.min(Math.max(0, hintsUsed), maxHints);
  return "💡".repeat(used) + "⬜".repeat(maxHints - used);
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
    const hintsUsed = primaryRange?.hintsUsed ?? 0;
    const widthYears = primaryRange ? primaryRange.end - primaryRange.start + 1 : null;

    // Header: Chrondle #96 85/100 or Chrondle #96 ✗
    const header = hasWon
      ? `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""} ${totalScore}/100`
      : `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""} ✗`;

    // Hints visualization: 💡💡⬜⬜⬜⬜
    const hints = generateHintsBar(hintsUsed);

    // Result: 🎯 15-year window or 📏 25-year window (missed)
    const result = hasWon
      ? `🎯 ${widthYears}-year window`
      : `📏 ${widthYears}-year window (missed)`;

    return `${header}\n\n${hints}\n${result}\n\nchrondle.app`;
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: Game complete\nchrondle.app`;
  }
}
