import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { updatePuzzleStats } from "../lib/puzzleHelpers";
import { updateUserStreak } from "../lib/streakHelpers";
import { NormalizedPlay, RangeRecord, normalizePlayData } from "../lib/migrationHelpers";
import { scoreRange } from "../../src/lib/scoring";
import type { HintCount } from "../../src/types/range";

/**
 * Puzzle Mutations - Game State Changes
 *
 * Module: Single responsibility - game state mutations
 * Deep Module Value: Hides complex play/stats/streak logic behind simple submitGuess API
 *
 * Exports:
 * - submitGuess: Submit a single-year guess for authenticated users
 * - submitRange: Submit a range guess with authoritative scoring
 *
 * Dependencies:
 * - updatePuzzleStats: Imported from lib/puzzleHelpers.ts
 * - updateUserStreak: Imported from lib/streakHelpers.ts
 */

// Game configuration
const MAX_ATTEMPTS = 6;

function ensureHintLevel(level: number): HintCount {
  if (Number.isFinite(level) && level >= 0 && level <= 6) {
    return level as HintCount;
  }
  throw new Error(`Invalid hint level: ${level}`);
}

function getAttemptCount(play: NormalizedPlay | null): number {
  if (!play) {
    return 0;
  }
  return play.ranges.length;
}

async function handlePostRangeSubmission(
  ctx: Parameters<typeof updatePuzzleStats>[0],
  userId: Id<"users">,
  puzzleId: Id<"puzzles">,
  puzzleDate: string,
  hasWon: boolean,
  hasLost: boolean,
): Promise<void> {
  if (hasWon) {
    await updatePuzzleStats(ctx, puzzleId);
    try {
      await updateUserStreak(ctx, userId, true, puzzleDate);
    } catch (error) {
      console.error("[submitRange] Streak update failed (non-critical):", error);
    }
    return;
  }

  if (hasLost) {
    try {
      await updateUserStreak(ctx, userId, false, puzzleDate);
    } catch (error) {
      console.error("[submitRange] Streak update failed (non-critical):", error);
    }
  }
}

/**
 * Submit a guess for an authenticated user
 *
 * Handles:
 * - Creating/updating play records
 * - Checking correctness against puzzle target year
 * - Updating puzzle statistics on completion
 * - Managing user streaks (daily puzzles only)
 * - Enforcing MAX_ATTEMPTS limit
 *
 * @param puzzleId - Puzzle being played
 * @param userId - Authenticated user
 * @param guess - Year guess
 * @returns Guess result with correctness and updated state
 */
export const submitGuess = mutation({
  args: {
    puzzleId: v.id("puzzles"),
    userId: v.id("users"),
    guess: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the puzzle to check the target year
    const puzzle = await ctx.db.get(args.puzzleId);
    if (!puzzle) {
      throw new Error("Puzzle not found");
    }

    // Check if play record exists
    const existingPlay = await ctx.db
      .query("plays")
      .withIndex("by_user_puzzle", (q) => q.eq("userId", args.userId).eq("puzzleId", args.puzzleId))
      .first();

    const isCorrect = args.guess === puzzle.targetYear;

    if (existingPlay) {
      // Don't allow guesses on completed puzzles
      if (existingPlay.completedAt) {
        throw new Error("Puzzle already completed");
      }

      const existingGuesses = existingPlay.guesses ?? [];

      if (existingGuesses.length >= MAX_ATTEMPTS) {
        throw new Error("Maximum attempts reached");
      }

      // Add guess to existing play
      const updatedGuesses = [...existingGuesses, args.guess];

      await ctx.db.patch(existingPlay._id, {
        guesses: updatedGuesses,
        completedAt: isCorrect ? Date.now() : undefined,
        updatedAt: Date.now(),
      });

      // Update puzzle stats and streak
      if (isCorrect) {
        await updatePuzzleStats(ctx, args.puzzleId);

        // Update streak with error handling to prevent breaking puzzle submission
        try {
          await updateUserStreak(ctx, args.userId, true, puzzle.date);
        } catch (error) {
          console.error("[submitGuess] Streak update failed (non-critical):", error);
          // Continue - puzzle submission still succeeds even if streak update fails
        }
      } else if (updatedGuesses.length >= MAX_ATTEMPTS) {
        // Game lost - reset streak to 0 (only for today's daily puzzle)
        try {
          await updateUserStreak(ctx, args.userId, false, puzzle.date);
        } catch (error) {
          console.error("[submitGuess] Streak update failed (non-critical):", error);
          // Continue - puzzle submission still succeeds even if streak update fails
        }
      }

      return {
        correct: isCorrect,
        guesses: updatedGuesses,
        targetYear: puzzle.targetYear,
      };
    } else {
      // Create new play record
      await ctx.db.insert("plays", {
        userId: args.userId,
        puzzleId: args.puzzleId,
        guesses: [args.guess],
        completedAt: isCorrect ? Date.now() : undefined,
        updatedAt: Date.now(),
      });

      // Update puzzle stats and streak
      if (isCorrect) {
        await updatePuzzleStats(ctx, args.puzzleId);
        await updateUserStreak(ctx, args.userId, true, puzzle.date);
      }
      // Note: For new play records, we never have MAX_ATTEMPTS on first submission
      // Loss streak reset only happens in the existing play path above

      return {
        correct: isCorrect,
        guesses: [args.guess],
        targetYear: puzzle.targetYear,
      };
    }
  },
});

export const submitRange = mutation({
  args: {
    puzzleId: v.id("puzzles"),
    userId: v.id("users"),
    start: v.number(),
    end: v.number(),
    hintsUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const puzzle = await ctx.db.get(args.puzzleId);
    if (!puzzle) {
      throw new Error("Puzzle not found");
    }

    const hintLevel = ensureHintLevel(args.hintsUsed);
    const timestamp = Date.now();

    // Normalize range bounds (handle inverted ranges)
    const normalizedStart = Math.min(args.start, args.end);
    const normalizedEnd = Math.max(args.start, args.end);

    // Derive containment from bounds check - independent of score
    // This prevents edge case where max-width correct ranges score 0
    const contained = normalizedStart <= puzzle.targetYear && puzzle.targetYear <= normalizedEnd;
    const score = scoreRange(normalizedStart, normalizedEnd, puzzle.targetYear, 0, hintLevel);

    const rangeEntry: RangeRecord = {
      start: normalizedStart,
      end: normalizedEnd,
      hintsUsed: hintLevel,
      score,
      timestamp,
    };

    const existingPlay = await ctx.db
      .query("plays")
      .withIndex("by_user_puzzle", (q) => q.eq("userId", args.userId).eq("puzzleId", args.puzzleId))
      .first();

    if (existingPlay) {
      if (existingPlay.completedAt) {
        throw new Error("Puzzle already completed");
      }

      const normalizedPlay = normalizePlayData(existingPlay);
      if (!normalizedPlay) {
        throw new Error("Unable to normalize play record");
      }

      if (getAttemptCount(normalizedPlay) >= MAX_ATTEMPTS) {
        throw new Error("Maximum attempts reached");
      }

      const updatedRanges = [...normalizedPlay.ranges, rangeEntry];
      const totalScore = normalizedPlay.totalScore + score;
      const hasLost = !contained && updatedRanges.length >= MAX_ATTEMPTS;

      await ctx.db.patch(existingPlay._id, {
        ranges: updatedRanges,
        guesses: existingPlay.guesses ?? [],
        totalScore,
        completedAt: contained || hasLost ? timestamp : existingPlay.completedAt,
        updatedAt: timestamp,
      });

      await handlePostRangeSubmission(
        ctx,
        args.userId,
        args.puzzleId,
        puzzle.date,
        contained,
        hasLost,
      );

      return {
        contained,
        range: rangeEntry,
        ranges: updatedRanges,
        totalScore,
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - updatedRanges.length),
        targetYear: puzzle.targetYear,
      };
    }

    const initialRanges = [rangeEntry];
    const totalScore = score;

    await ctx.db.insert("plays", {
      userId: args.userId,
      puzzleId: args.puzzleId,
      guesses: [],
      ranges: initialRanges,
      totalScore,
      completedAt: contained ? timestamp : undefined,
      updatedAt: timestamp,
    });

    await handlePostRangeSubmission(ctx, args.userId, args.puzzleId, puzzle.date, contained, false);

    return {
      contained,
      range: rangeEntry,
      ranges: initialRanges,
      totalScore,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - initialRanges.length),
      targetYear: puzzle.targetYear,
    };
  },
});

/**
 * Internal mutation to update puzzle events and quality after Judge evaluation
 *
 * Called by optimizePuzzleComposition action to:
 * - Reorder events based on Judge's Hard → Easy recommendation
 * - Store quality scores for analytics
 *
 * @param puzzleId - Puzzle to update
 * @param events - Reordered events (Hard → Easy)
 * @param puzzleQuality - Quality scores from Judge
 */
export const updatePuzzleEvents = internalMutation({
  args: {
    puzzleId: v.id("puzzles"),
    events: v.array(v.string()),
    puzzleQuality: v.object({
      qualityScore: v.number(),
      composition: v.object({
        topicDiversity: v.number(),
        geographicSpread: v.number(),
        difficultyGradient: v.number(),
        guessability: v.number(),
      }),
      orderingRationale: v.optional(v.string()),
      judgedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const { puzzleId, events, puzzleQuality } = args;

    const puzzle = await ctx.db.get(puzzleId);
    if (!puzzle) {
      throw new Error(`Puzzle ${puzzleId} not found`);
    }

    // Check if puzzle has been played - don't update mid-game
    const existingPlay = await ctx.db
      .query("plays")
      .withIndex("by_puzzle", (q) => q.eq("puzzleId", puzzleId))
      .first();

    if (existingPlay) {
      console.log(
        `[updatePuzzleEvents] Skipping update for puzzle ${puzzleId} - already has plays`,
      );
      return;
    }

    await ctx.db.patch(puzzleId, {
      events,
      puzzleQuality,
      updatedAt: Date.now(),
    });

    console.log(
      `[updatePuzzleEvents] Updated puzzle ${puzzleId} with quality score ${puzzleQuality.qualityScore.toFixed(2)}`,
    );
  },
});
