/**
 * Classic mode share text.
 *
 * Grammar chosen from docs/labs/classic-share-grammar-lab.html option 3,
 * "Narrowing Funnel" (see rationale in that lab and on Powder card
 * chrondle-ux-share-unification): the body leads with the sequence of
 * range *widths* across every guess this run ("250 → 60 → 15y"), which is
 * the actual mechanic Classic asks a player to perform — narrow a range
 * turn over turn — not just its final value. A dedicated outcome line then
 * states contained/missed explicitly, and a score line closes it out.
 *
 * Spoiler safety: only relative widths, miss distance, and miss direction
 * are ever surfaced — never an absolute calendar year (the guessed
 * start/end years, and the target year, are deliberately never read here).
 */

import type { RangeGuess } from "@/types/range";
import { logger } from "@/lib/logger";
import { buildShareHeader, buildShareText, CHRONDLE_URL } from "./format";

export interface ClassicShareOptions {
  missDistance?: number | null;
  missDirection?: "earlier" | "later" | null;
}

function getPrimaryRange(ranges: RangeGuess[]): RangeGuess | undefined {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return undefined;
  }
  return ranges[ranges.length - 1];
}

function widthOf(range: RangeGuess): number {
  return range.end - range.start + 1;
}

function getScoreEmoji(score: number, hasWon: boolean): string {
  if (!hasWon) return "🫠";
  if (score >= 100) return "🎯";
  if (score >= 90) return "🔥";
  if (score >= 80) return "⭐";
  if (score >= 70) return "😎";
  return "👍";
}

function buildOutcomeLine(hasWon: boolean, options: ClassicShareOptions): string {
  if (hasWon) {
    return "✅ Contained";
  }

  if (
    options.missDistance !== undefined &&
    options.missDistance !== null &&
    options.missDirection
  ) {
    const direction = options.missDirection === "earlier" ? "early" : "late";
    return `❌ ${options.missDistance}y ${direction}`;
  }

  return "❌ Missed";
}

export function generateClassicShareText(
  ranges: RangeGuess[],
  totalScore: number,
  hasWon: boolean,
  puzzleNumber?: number,
  options: ClassicShareOptions = {},
): string {
  try {
    if (
      !Array.isArray(ranges) ||
      ranges.length === 0 ||
      ranges.some((range) => typeof range.start !== "number")
    ) {
      logger.error("Invalid ranges passed to generateClassicShareText");
      return "Chrondle share text generation failed";
    }

    const primaryRange = getPrimaryRange(ranges);
    if (!primaryRange) {
      return "Chrondle share text generation failed";
    }

    const funnelLine = `🔻 ${ranges.map(widthOf).join(" → ")}y`;
    const outcomeLine = buildOutcomeLine(hasWon, options);
    const scoreLine = `${getScoreEmoji(totalScore, hasWon)} ${totalScore}/100`;

    const header = buildShareHeader(null, puzzleNumber);
    return buildShareText(header, [funnelLine, outcomeLine, scoreLine], CHRONDLE_URL);
  } catch (error) {
    logger.error("Failed to generate Classic share text:", error);
    return `Chrondle: Game complete\n${CHRONDLE_URL}`;
  }
}
