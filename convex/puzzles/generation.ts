import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { selectYearForPuzzle } from "../lib/puzzleHelpers";

/**
 * Puzzle Generation Module
 *
 * Module: Single responsibility - puzzle creation
 * Deep Module Value: Hides complex generation/scheduling logic behind simple APIs
 *
 * Exports:
 * - generateDailyPuzzle: Internal mutation for cron job
 * - ensureTodaysPuzzle: Public mutation to ensure today's puzzle exists
 * - manualGeneratePuzzle: Development-only manual trigger
 *
 * Dependencies:
 * - selectYearForPuzzle: Imported from lib/puzzleHelpers.ts
 */

/**
 * Internal mutation for cron job to generate daily puzzle
 *
 * Triggered by scheduled cron job to create puzzles at midnight UTC.
 * Can also be called with specific date for on-demand generation.
 *
 * @param force - Optional flag to force generation (unused currently)
 * @param date - Optional specific date (YYYY-MM-DD) for generation
 * @returns Status and puzzle metadata
 */
export const generateDailyPuzzle = internalMutation({
  args: {
    force: v.optional(v.boolean()),
    date: v.optional(v.string()), // Allow specific date for on-demand generation
  },
  handler: async (ctx, args) => {
    // Get the target date - either specified or today in UTC
    const targetDate = args.date || new Date().toISOString().slice(0, 10);

    // Check if puzzle already exists for this date
    const existingPuzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", targetDate))
      .first();

    if (existingPuzzle) {
      console.warn(`Puzzle for ${targetDate} already exists`);
      return { status: "already_exists", puzzle: existingPuzzle };
    }

    // Get the highest puzzle number
    const latestPuzzle = await ctx.db.query("puzzles").order("desc").first();

    const nextPuzzleNumber = (latestPuzzle?.puzzleNumber || 0) + 1;

    // Select a year with 6+ unused events and get random events from it
    const { year: selectedYear, events: selectedEvents } = await selectYearForPuzzle(ctx);

    // Create the puzzle
    const puzzleId = await ctx.db.insert("puzzles", {
      puzzleNumber: nextPuzzleNumber,
      date: targetDate,
      targetYear: selectedYear,
      events: selectedEvents.map((e) => e.event),
      playCount: 0,
      avgGuesses: 0,
      updatedAt: Date.now(),
    });

    // Mark events as used in Classic mode
    for (const event of selectedEvents) {
      await ctx.db.patch(event._id, {
        classicPuzzleId: puzzleId,
        updatedAt: Date.now(),
      });
    }

    // Schedule historical context generation (non-blocking)
    try {
      await ctx.scheduler.runAfter(
        0, // Run immediately
        internal.actions.historicalContext.generateHistoricalContext,
        {
          puzzleId,
          year: selectedYear,
          events: selectedEvents.map((e) => e.event),
        },
      );

      console.warn(
        `Scheduled historical context generation for puzzle ${puzzleId} (year ${selectedYear})`,
      );
    } catch (schedulerError) {
      // Log but don't fail puzzle creation - graceful degradation
      console.error(
        `[generateDailyPuzzle] Failed to schedule context generation for puzzle ${puzzleId}:`,
        schedulerError,
      );
    }

    console.warn(`Created puzzle #${nextPuzzleNumber} for ${targetDate} with year ${selectedYear}`);

    return {
      status: "created",
      puzzle: {
        _id: puzzleId,
        puzzleNumber: nextPuzzleNumber,
        date: targetDate,
        targetYear: selectedYear,
      },
    };
  },
});

/**
 * Public mutation to ensure today's puzzle exists
 *
 * Called by frontend on load to guarantee today's puzzle is available.
 * Idempotent - returns existing puzzle if already created.
 *
 * @returns Status and puzzle data
 */
export const ensureTodaysPuzzle = mutation({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);

    // Check if puzzle already exists
    const existingPuzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    if (existingPuzzle) {
      return { status: "exists", puzzle: existingPuzzle };
    }

    // Trigger generation using shared logic
    console.warn(`[ensureTodaysPuzzle] Generating puzzle for ${today}`);

    // Get the highest puzzle number
    const latestPuzzle = await ctx.db.query("puzzles").order("desc").first();
    const nextPuzzleNumber = (latestPuzzle?.puzzleNumber || 0) + 1;

    // Select a year with 6+ unused events and get random events from it
    const { year: selectedYear, events: selectedEvents } = await selectYearForPuzzle(ctx);

    const puzzleId = await ctx.db.insert("puzzles", {
      puzzleNumber: nextPuzzleNumber,
      date: today,
      targetYear: selectedYear,
      events: selectedEvents.map((e) => e.event),
      playCount: 0,
      avgGuesses: 0,
      updatedAt: Date.now(),
    });

    // Mark events as used in Classic mode
    for (const event of selectedEvents) {
      await ctx.db.patch(event._id, {
        classicPuzzleId: puzzleId,
        updatedAt: Date.now(),
      });
    }

    const newPuzzle = await ctx.db.get(puzzleId);

    console.warn(`Created puzzle #${nextPuzzleNumber} for ${today} with year ${selectedYear}`);

    return { status: "created", puzzle: newPuzzle };
  },
});

/**
 * Manual trigger for generating a puzzle (development only)
 *
 * TODO: Implement proper manual generation with date selection
 * Currently disabled to avoid circular dependency issues.
 *
 * @returns Error status in development, throws in production
 */
export const manualGeneratePuzzle = mutation({
  handler: async () => {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      throw new Error("Manual puzzle generation not allowed in production");
    }

    // TODO: Refactor to avoid circular dependency
    // For now, returning a placeholder since this is dev-only
    return {
      status: "error",
      message:
        "Manual generation temporarily disabled due to circular dependency. Use cron job instead.",
    };
  },
});
