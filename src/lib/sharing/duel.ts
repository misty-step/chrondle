/**
 * Duel mode share text.
 *
 * Body expresses the mechanic that matters in an endless run — streak
 * length and difficulty tier reached, with the ending gap (if the run
 * ended on a miss) and a personal-best callout. Only a relative year *gap*
 * is ever read, never the absolute years of the pair that ended the run.
 */

import { buildShareHeader, buildShareText } from "./format";

const DUEL_URL = "https://chrondle.app/duel";

export interface DuelShareInput {
  /** Final streak for the run */
  streak: number;
  /** Player's best streak after this run */
  bestStreak: number;
  /** Tier label reached when the run ended */
  tierLabel: string;
  /** Year gap of the pair that ended the run (null if run never ended on a miss) */
  finalGap: number | null;
}

export function generateDuelShareText(input: DuelShareInput): string {
  const { streak, bestStreak, tierLabel, finalGap } = input;

  const lines: string[] = [`⚔️ ${streak} in a row · ${tierLabel}`];

  if (typeof finalGap === "number" && finalGap > 0) {
    const yearLabel = finalGap === 1 ? "year" : "years";
    lines.push(`Felled by a gap of ${finalGap} ${yearLabel}`);
  }

  if (streak > 0 && streak >= bestStreak) {
    lines.push("🏆 New personal best");
  }

  const header = buildShareHeader("Duel");
  return buildShareText(header, lines, DUEL_URL);
}
