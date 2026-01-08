"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { judgePuzzleComposition } from "./judge";
import { logStageError, logStageSuccess } from "../../lib/logging";

/**
 * Optimize Puzzle Action
 *
 * Called after puzzle creation to:
 * 1. Judge the puzzle's event composition
 * 2. Reorder events Hard → Easy based on Judge recommendation
 * 3. Store quality scores for analytics
 *
 * This is a non-blocking optimization - puzzle works without it,
 * but is improved when judging succeeds.
 */
export const optimizePuzzleComposition = internalAction({
  args: {
    puzzleId: v.id("puzzles"),
    year: v.number(),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { puzzleId, year, events } = args;

    // Determine era from year
    const era = year < 0 ? "BCE" : "CE";
    const displayYear = Math.abs(year);

    try {
      // Judge the puzzle
      const result = await judgePuzzleComposition({
        year: displayYear,
        era,
        events,
      });

      logStageSuccess("OptimizePuzzle", "Judging complete", {
        puzzleId,
        year,
        approved: result.judgment.approved,
        qualityScore: result.judgment.qualityScore,
      });

      // Always update with quality scores, even if not approved
      // Only reorder if approved (quality threshold met)
      const orderedEvents = result.judgment.approved
        ? result.judgment.ordering.recommended
        : events; // Keep original order if not approved

      // Update puzzle with ordered events and quality scores
      await ctx.runMutation(internal.puzzles.mutations.updatePuzzleEvents, {
        puzzleId,
        events: orderedEvents,
        puzzleQuality: {
          qualityScore: result.judgment.qualityScore,
          composition: result.judgment.composition,
          orderingRationale: result.judgment.ordering.rationale,
          judgedAt: Date.now(),
        },
      });

      return {
        status: "success",
        approved: result.judgment.approved,
        qualityScore: result.judgment.qualityScore,
        reordered: result.judgment.approved,
      };
    } catch (error) {
      logStageError("OptimizePuzzle", error, { puzzleId, year });

      // Non-blocking - puzzle still works, just not optimized
      return {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
