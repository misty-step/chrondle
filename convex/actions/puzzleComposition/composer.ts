"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { judgePuzzleComposition, type JudgeActionResult } from "./judge";
import { logStageError, logStageSuccess } from "../../lib/logging";

/**
 * Puzzle Composer
 *
 * Orchestrates puzzle composition by:
 * 1. Taking candidate events for a year
 * 2. Calling the Puzzle Judge to evaluate and order them
 * 3. Retrying with different event selections if rejected
 * 4. Falling back to legacy shuffle if all attempts fail
 *
 * Key decisions:
 * - Max 3 composition attempts before fallback
 * - Judge orders events Hard → Easy
 * - On rejection: suggests trying different year selection
 */

const MAX_COMPOSITION_ATTEMPTS = 3;

export interface ComposerParams {
  year: number;
  events: string[];
}

export interface CompositionSuccess {
  status: "success";
  orderedEvents: string[];
  judgment: JudgeActionResult["judgment"];
  attempts: number;
}

export interface CompositionFailed {
  status: "failed";
  reason: string;
  attempts: number;
  lastJudgment?: JudgeActionResult["judgment"];
}

export type CompositionResult = CompositionSuccess | CompositionFailed;

/**
 * Convex action to compose a puzzle with quality judging
 *
 * Called after year/events are selected to get optimal ordering.
 * If judgment fails, returns failure status for caller to handle retries.
 */
export const composePuzzle = internalAction({
  args: {
    year: v.number(),
    events: v.array(v.string()),
  },
  handler: async (_ctx, args): Promise<CompositionResult> => {
    return composePuzzleWithJudge({
      year: args.year,
      events: args.events,
    });
  },
});

/**
 * Core composition logic - evaluates events and returns ordered result
 *
 * This function makes a single judgment call. For retry logic with
 * different year selections, the caller (mutation) should handle
 * the retry loop since it has database access.
 */
export async function composePuzzleWithJudge(params: ComposerParams): Promise<CompositionResult> {
  const { year, events } = params;

  if (events.length < 6) {
    return {
      status: "failed",
      reason: `Need at least 6 events, got ${events.length}`,
      attempts: 0,
    };
  }

  // Determine era from year
  const era = year < 0 ? "BCE" : "CE";
  const displayYear = Math.abs(year);

  try {
    const result = await judgePuzzleComposition({
      year: displayYear,
      era,
      events: events.slice(0, 6), // Only judge first 6
    });

    if (result.judgment.approved) {
      logStageSuccess("Composer", "Puzzle approved", {
        year,
        qualityScore: result.judgment.qualityScore,
      });

      return {
        status: "success",
        orderedEvents: result.judgment.ordering.recommended,
        judgment: result.judgment,
        attempts: 1,
      };
    }

    // Not approved - return failure with judgment details
    logStageSuccess("Composer", "Puzzle rejected by judge", {
      year,
      qualityScore: result.judgment.qualityScore,
      issues: result.judgment.issues,
    });

    return {
      status: "failed",
      reason: result.judgment.issues.join("; ") || "Below quality threshold",
      attempts: 1,
      lastJudgment: result.judgment,
    };
  } catch (error) {
    logStageError("Composer", error, { year, eventCount: events.length });

    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Unknown error",
      attempts: 1,
    };
  }
}

/**
 * Compose puzzle with multiple year attempts
 *
 * This is the full orchestration that tries multiple years.
 * Takes a function to get next year candidates, allowing the caller
 * to control year selection strategy.
 *
 * @param getYearCandidates - Function that returns year + events to try
 * @param maxAttempts - Maximum number of years to try
 */
export async function composePuzzleWithRetries(
  getYearCandidates: () => Promise<{ year: number; events: string[] } | null>,
  maxAttempts: number = MAX_COMPOSITION_ATTEMPTS,
): Promise<CompositionResult & { attemptedYears: number[] }> {
  const attemptedYears: number[] = [];
  let lastResult: CompositionResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidates = await getYearCandidates();

    if (!candidates) {
      return {
        status: "failed",
        reason: "No more year candidates available",
        attempts: attempt,
        attemptedYears,
      };
    }

    attemptedYears.push(candidates.year);

    const result = await composePuzzleWithJudge(candidates);
    lastResult = result;

    if (result.status === "success") {
      return {
        ...result,
        attempts: attempt + 1,
        attemptedYears,
      };
    }

    // Log retry
    console.log(
      `[Composer] Year ${candidates.year} rejected (attempt ${attempt + 1}/${maxAttempts}): ${result.reason}`,
    );
  }

  // All attempts failed
  return {
    status: "failed",
    reason: `All ${maxAttempts} attempts failed`,
    attempts: maxAttempts,
    lastJudgment: lastResult?.status === "failed" ? lastResult.lastJudgment : undefined,
    attemptedYears,
  };
}

/**
 * Legacy fallback: Fisher-Yates shuffle (original behavior)
 *
 * Used when Judge is unavailable or all attempts fail.
 * Maintains backward compatibility with existing puzzle generation.
 */
export function legacyShuffleEvents(events: string[]): string[] {
  const shuffled = [...events];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 6);
}

// Feature flag moved to convex/lib/featureFlags.ts
export { isPuzzleJudgeEnabled as isComposerEnabled } from "../../lib/featureFlags";
