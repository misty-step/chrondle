/**
 * Duel mode share grammar: run length (the streak mechanic) with tier, the
 * gap that ended the run (relative years only — never the pair's dates),
 * and a personal-best flourish.
 */

import { SHARE_URL, composeShareText, count } from "./format";

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

  const body: string[] = [`⚔️ ${streak} in a row · ${tierLabel}`];

  if (typeof finalGap === "number" && finalGap > 0) {
    body.push(`Felled by a gap of ${count(finalGap, "year")}`);
  }

  if (streak > 0 && streak >= bestStreak) {
    body.push("🏆 New personal best");
  }

  return composeShareText({
    mode: "Duel",
    body,
    url: `${SHARE_URL}/duel`,
  });
}
