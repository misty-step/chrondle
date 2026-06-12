/**
 * Duel mode difficulty curve.
 *
 * Duel is an endless "which happened first?" run: every round shows two
 * historical events and the player taps the earlier one. Tension comes from
 * the year gap between the two events shrinking as the run goes on — early
 * rounds are centuries apart, late rounds come down to a handful of years.
 *
 * This module is the single source of truth for that ramp. It is imported by
 * both the Convex pair-selection code (which enforces the gap when sampling
 * events) and the client UI (which displays the tier label).
 */

export interface DuelTier {
  /** 0-based round index at which this tier begins */
  startRound: number;
  /** Inclusive minimum year gap between the two events */
  minGap: number;
  /** Inclusive maximum year gap between the two events */
  maxGap: number;
  /** Player-facing tier name */
  label: string;
}

/**
 * Tiers must be ordered by ascending startRound, beginning at 0.
 * Gap windows narrow monotonically so runs always get harder.
 */
export const DUEL_TIERS: readonly DuelTier[] = [
  { startRound: 0, minGap: 200, maxGap: 4000, label: "Novice" },
  { startRound: 3, minGap: 75, maxGap: 200, label: "Apprentice" },
  { startRound: 6, minGap: 30, maxGap: 75, label: "Scholar" },
  { startRound: 10, minGap: 10, maxGap: 30, label: "Historian" },
  { startRound: 15, minGap: 4, maxGap: 10, label: "Archivist" },
  { startRound: 20, minGap: 1, maxGap: 4, label: "Legend" },
] as const;

/**
 * Resolve the difficulty tier for a 0-based round index.
 * Rounds past the last tier stay in the last tier forever.
 */
export function tierForRound(round: number): DuelTier {
  const safeRound = Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0;

  let current: DuelTier = DUEL_TIERS[0];
  for (const tier of DUEL_TIERS) {
    if (safeRound >= tier.startRound) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}
