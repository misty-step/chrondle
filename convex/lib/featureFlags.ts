/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollouts
 * and easy disabling in case of issues.
 */

/**
 * Check if Puzzle Judge/Composer is enabled
 *
 * Controls whether newly generated puzzles have their hints
 * ordered Hard → Easy by the Puzzle Judge LLM.
 *
 * Disable by setting PUZZLE_JUDGE_ENABLED=false or 0
 */
export function isPuzzleJudgeEnabled(): boolean {
  const flag = process.env.PUZZLE_JUDGE_ENABLED;
  // Enabled by default unless explicitly disabled
  return flag !== "false" && flag !== "0";
}
