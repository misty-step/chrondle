/**
 * Pure derivation for "has this daily mode been finished today?"
 *
 * Sources mirror what each game page already trusts for restore:
 * server plays for signed-in players, the anonymous local session
 * otherwise. Kept dependency-free so it is trivially testable; the
 * wiring lives in src/hooks/useTodayModeStatus.ts.
 */

export type ModeTodayStatus = "done" | "todo" | "endless" | "unknown";

export interface DailyModeStatusInput {
  /** Today's puzzle id for the mode, or null while loading/unavailable */
  puzzleId: string | null;
  isAuthenticated: boolean;
  /** Server play completion; null while loading or not queried */
  serverCompleted: boolean | null;
  /** Anonymous local session completion for today's puzzle */
  localCompleted: boolean;
}

export function deriveDailyModeStatus(input: DailyModeStatusInput): ModeTodayStatus {
  if (!input.puzzleId) {
    return "unknown";
  }

  if (input.isAuthenticated) {
    // Server is the source of truth for signed-in players; stale anonymous
    // localStorage must never mark a signed-in player done.
    if (input.serverCompleted === null) {
      return "unknown";
    }
    return input.serverCompleted ? "done" : "todo";
  }

  return input.localCompleted ? "done" : "todo";
}
