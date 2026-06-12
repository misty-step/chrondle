/**
 * Share text for Duel runs (NYT Games style, matches Classic's generator).
 */

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

  const lines: string[] = ["Chrondle Duel"];
  lines.push(`⚔️ ${streak} in a row · ${tierLabel}`);

  if (typeof finalGap === "number" && finalGap > 0) {
    const yearLabel = finalGap === 1 ? "year" : "years";
    lines.push(`Felled by a gap of ${finalGap} ${yearLabel}`);
  }

  if (streak > 0 && streak >= bestStreak) {
    lines.push("🏆 New personal best");
  }

  return `${lines.join("\n")}\n\nhttps://chrondle.app/duel`;
}
