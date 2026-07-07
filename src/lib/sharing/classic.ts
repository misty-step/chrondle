/**
 * Classic mode share grammar: Timeline Band + Target Marker.
 *
 * Locked via the share-grammar design lab (Option B,
 * explorations/share-grammar-lab.html): a 10-cell strip where band length is
 * proportional to log(range width), the 🎯 marker inside the band means the
 * year was contained, and a marker beyond the band edge shows a miss and its
 * direction. The strip has no anchored scale, so it can never leak the year
 * or its era.
 */

import type { RangeGuess } from "@/types/range";
import { logger } from "@/lib/logger";
import { composeShareText, count } from "./format";

export interface ClassicShareOptions {
  targetYear?: number;
  missDistance?: number | null;
  missDirection?: "earlier" | "later" | null;
}

const STRIP_CELLS = 10;
const MAX_BAND_CELLS = 8;
/** Range width (years) mapped to the full band: ln(width)/ln(WIDTH_SCALE). */
const WIDTH_SCALE = 250;
/** Miss distances beyond this many years push the marker a second cell out. */
const FAR_MISS_YEARS = 25;

const EMPTY_CELL = "⬜";
const CONTAINED_CELL = "🟩";
const MISSED_CELL = "🟨";
const TARGET_CELL = "🎯";

function bandLength(width: number): number {
  const raw = Math.round(1 + (7 * Math.log(Math.max(1, width))) / Math.log(WIDTH_SCALE));
  return Math.min(Math.max(raw, 1), MAX_BAND_CELLS);
}

/**
 * Renders the 10-cell timeline strip.
 *
 * Contained: green band centered, 🎯 at its center cell.
 * Missed: amber band with 🎯 one cell beyond its edge (two when the miss
 * distance exceeds FAR_MISS_YEARS), the whole figure centered; "earlier"
 * misses (the year was later than the range) place the marker on the right,
 * "later" misses mirror the figure.
 * Loss without miss info: centered amber band, no marker.
 */
function renderTimelineStrip(
  width: number,
  contained: boolean,
  missDistance: number | null | undefined,
  missDirection: "earlier" | "later" | null | undefined,
): string {
  const band = bandLength(width);
  const cells: string[] = new Array(STRIP_CELLS).fill(EMPTY_CELL);

  if (contained) {
    const start = Math.floor((STRIP_CELLS - band) / 2);
    for (let i = start; i < start + band; i++) cells[i] = CONTAINED_CELL;
    cells[start + Math.floor(band / 2)] = TARGET_CELL;
    return cells.join("");
  }

  if (!missDirection) {
    const start = Math.floor((STRIP_CELLS - band) / 2);
    for (let i = start; i < start + band; i++) cells[i] = MISSED_CELL;
    return cells.join("");
  }

  const offset = (missDistance ?? 0) > FAR_MISS_YEARS ? 2 : 1;
  const span = Math.min(band + offset, STRIP_CELLS);
  const start = Math.floor((STRIP_CELLS - span) / 2);
  for (let i = start; i < start + band; i++) cells[i] = MISSED_CELL;
  cells[start + span - 1] = TARGET_CELL;
  // Built with the marker on the right ("earlier": the year was later than
  // the guessed range). A "later" miss is the mirror image.
  if (missDirection === "later") cells.reverse();
  return cells.join("");
}

function getScoreEmoji(score: number, hasWon: boolean): string {
  if (!hasWon) return "🫠";
  if (score >= 100) return "🎯";
  if (score >= 90) return "🔥";
  if (score >= 80) return "⭐";
  if (score >= 70) return "😎";
  return "👍";
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

    const primaryRange = ranges[ranges.length - 1];
    if (!primaryRange) {
      return "Chrondle share text generation failed";
    }

    const hintsUsed = primaryRange.hintsUsed ?? 0;
    const widthYears = primaryRange.end - primaryRange.start + 1;

    const hasMissInfo =
      !hasWon &&
      options.missDistance !== undefined &&
      options.missDistance !== null &&
      Boolean(options.missDirection);

    const strip = renderTimelineStrip(
      widthYears,
      hasWon,
      hasMissInfo ? options.missDistance : null,
      hasMissInfo ? options.missDirection : null,
    );

    const statLine =
      `📏 ${count(widthYears, "year")}` +
      (hintsUsed > 0 ? ` · 🔍 ${count(hintsUsed, "hint")}` : "");

    const scoreEmoji = getScoreEmoji(totalScore, hasWon);
    const scoreLine = hasMissInfo
      ? `${scoreEmoji} ${options.missDistance}y ${options.missDirection === "earlier" ? "early" : "late"}`
      : `${scoreEmoji} ${totalScore}/100`;

    return composeShareText({
      puzzleNumber,
      body: [strip, statLine, scoreLine],
    });
  } catch (error) {
    logger.error("Failed to generate share text:", error);
    return `Chrondle: Game complete\nchrondle.app`;
  }
}
