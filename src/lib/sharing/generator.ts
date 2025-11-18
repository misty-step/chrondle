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
 * @returns String like "💡💡⬜⬜⬜⬜ (2/6 hints)"
 */
function generateHintBar(hintsUsed: number): string {
  const maxHints = 6;
  const filled = "💡";
  const empty = "⬜";

  const cappedHints = Math.min(Math.max(0, hintsUsed), maxHints);
  const bar = filled.repeat(cappedHints) + empty.repeat(maxHints - cappedHints);
  return `${bar} (${cappedHints}/${maxHints} hints)`;
}

/**
 * Generate score visualization bar
 * @param score Score value (0-100)
 * @returns String like "████░░░░░░ (20/100 pts)"
 */
function generateScoreBar(score: number): string {
  const maxBlocks = 10;
  const filledBlock = "█";
  const emptyBlock = "░";

  const cappedScore = Math.min(Math.max(0, score), 100);
  const filledCount = Math.round((cappedScore / 100) * maxBlocks);
  const bar = filledBlock.repeat(filledCount) + emptyBlock.repeat(maxBlocks - filledCount);

  return `${bar} (${cappedScore}/100 pts)`;
}

/**
 * Format date as abbreviated string
 * @param date Date object
 * @returns String like "Nov 13"
 */
function formatDateAbbreviated(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
    const missDistance =
      !hasWon && primaryRange && typeof options.targetYear === "number"
        ? getMissDistance(primaryRange, options.targetYear)
        : null;

    const today = new Date();
    const dateAbbrev = formatDateAbbreviated(today);

    // Header with abbreviated date
    const header = `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""} • ${dateAbbrev}`;

    // Result line (win/loss with visual indicators)
    const resultLine = hasWon
      ? widthYears === 1
        ? "🎯 Contained in 1 year · Perfect!"
        : `🎯 Contained in ${widthYears} ${pluralize(widthYears ?? 1, "year")}`
      : missDistance !== null && missDistance > 0
        ? `❌ Missed by ${pluralize(missDistance, "year")} (${widthYears}-year window)`
        : widthYears
          ? `❌ Didn't contain it (${widthYears}-year window)`
          : "❌ Didn't contain it";

    // Hint bar visualization
    const hintBar = `💡 ${generateHintBar(hintsUsed)}`;

    // Score bar visualization
    const scoreBar = `📊 ${generateScoreBar(totalScore)}`;

    return `${header}\n\n${resultLine}\n${hintBar}\n${scoreBar}\n\nchrondle.app`;
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: ${hasWon ? "Victory" : "Learned something new"}\nhttps://www.chrondle.app`;
  }
}
