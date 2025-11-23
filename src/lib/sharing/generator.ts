/**
 * Social Sharing Content Generator
 * Generates formatted text for sharing game results on social media
 */

import type { RangeGuess } from "@/types/range";
import { pluralize } from "@/lib/displayFormatting";
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

function getMissDistance(range: RangeGuess, targetYear: number): number {
  if (targetYear < range.start) {
    return range.start - targetYear;
  }
  if (targetYear > range.end) {
    return targetYear - range.end;
  }
  return 0;
}

/**
 * Generate hint usage visualization
 * @param hintsUsed Number of hints used (0-6)
 * @returns String like "💡💡⚫⚫⚫⚫"
 */
function generateHintBar(hintsUsed: number): string {
  const maxHints = 6;
  const filled = "💡";
  const empty = "⚫";

  const cappedHints = Math.min(Math.max(0, hintsUsed), maxHints);
  return filled.repeat(cappedHints) + empty.repeat(maxHints - cappedHints);
}

export function generateShareText(
  ranges: RangeGuess[],
  totalScore: number,
  hasWon: boolean,
  puzzleNumber?: number,
  options: ShareTextOptions = {},
): string {
  try {
    if (!Array.isArray(ranges) || ranges.some((range) => typeof range.start !== "number")) {
      logger.error("Invalid ranges passed to generateShareText");
      return "Chrondle share text generation failed";
    }

    const primaryRange = getPrimaryRange(ranges);
    const hintsUsed = primaryRange?.hintsUsed ?? 0;
    const widthYears = primaryRange ? primaryRange.end - primaryRange.start + 1 : null;

    const header = `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""}`;

    let statsLine = "";

    if (hasWon && widthYears !== null) {
      const displayScore = Math.round(Math.max(0, Math.min(totalScore, 100)));
      const yrLabel = widthYears === 1 ? "yr" : "yrs";
      statsLine = `${displayScore}/100 pts · ${widthYears} ${yrLabel} range`;
    } else if (primaryRange && typeof options.targetYear === "number") {
      const dist = getMissDistance(primaryRange, options.targetYear);
      if (dist > 0) {
        const yrLabel = dist === 1 ? "yr" : "yrs";
        statsLine = `Missed by ${dist} ${yrLabel}`;
      } else {
        statsLine = "Missed target";
      }
    } else {
      statsLine = "Missed target";
    }

    const hintBar = generateHintBar(hintsUsed);

    return `${header}\n${statsLine}\n\n${hintBar}\n\nchrondle.app`;
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: ${hasWon ? "Victory" : "Result"}\nhttps://www.chrondle.app`;
  }
}
