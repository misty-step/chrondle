/**
 * Social Sharing Content Generator
 * Generates formatted text for sharing game results (NYT Games style)
 */

import type { RangeGuess } from "@/types/range";
import { logger } from "@/lib/logger";
import { GAME_CONFIG } from "@/lib/constants";

interface ShareTextOptions {
  targetYear?: number;
}

/**
 * Generates a progress bar of emojis based on how close the guess was
 * 5 squares total
 * Green = Hit
 * Yellow = Close
 * Red = Far
 */
function generateProximityBar(range: RangeGuess, targetYear: number): string {
  // Check if contained (Hit)
  const contained = range.start <= targetYear && range.end >= targetYear;
  if (contained) {
    return "🟩🟩🟩🟩🟩";
  }

  // Calculate distance from closest edge
  let distance = 0;
  if (range.end < targetYear) {
    distance = targetYear - range.end;
  } else {
    distance = range.start - targetYear;
  }

  // Map distance to bars
  // <= 25: 4 Yellow (Very Close)
  // <= 100: 3 Yellow (Close)
  // <= 500: 2 Red (Far)
  // > 500: 1 Red (Very Far)

  if (distance <= 25) return "🟨🟨🟨🟨⬜";
  if (distance <= 100) return "🟨🟨🟨⬜⬜";
  if (distance <= 500) return "🟥🟥⬜⬜⬜";
  return "🟥⬜⬜⬜⬜";
}

export function generateShareText(
  ranges: RangeGuess[],
  totalScore: number,
  hasWon: boolean,
  puzzleNumber?: number,
  options: ShareTextOptions = {},
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

    const { targetYear } = options;
    const maxGuesses = GAME_CONFIG.MAX_GUESSES;
    const attemptsCount = hasWon ? ranges.length : "X";

    // Header: Chrondle #96 4/6
    const header = `Chrondle${puzzleNumber ? ` #${puzzleNumber}` : ""} ${attemptsCount}/${maxGuesses}`;

    // Generate grid
    let grid = "";
    if (targetYear !== undefined) {
      grid = ranges.map((range) => generateProximityBar(range, targetYear)).join("\n");
    } else {
      // Fallback if targetYear is missing (shouldn't happen in normal play)
      grid = ranges
        .map((_, i) => (i === ranges.length - 1 && hasWon ? "🟩🟩🟩🟩🟩" : "⬜⬜⬜⬜⬜"))
        .join("\n");
    }

    return `${header}\n\n${grid}\n\nchrondle.app`;
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: Game complete\nchrondle.app`;
  }
}
