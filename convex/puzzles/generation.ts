import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { selectYearForPuzzle } from "../lib/puzzleHelpers";
import { isPuzzleJudgeEnabled } from "../lib/featureFlags";

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

    // Schedule puzzle composition optimization (non-blocking)
    // This will judge the puzzle and reorder hints Hard → Easy
    if (isPuzzleJudgeEnabled()) {
      try {
        await ctx.scheduler.runAfter(
          0, // Run immediately
          internal.actions.puzzleComposition.optimizePuzzle.optimizePuzzleComposition,
          {
            puzzleId,
            year: selectedYear,
            events: selectedEvents.map((e) => e.event),
          },
        );
        console.warn(
          `Scheduled puzzle composition optimization for puzzle ${puzzleId} (year ${selectedYear})`,
        );
      } catch (schedulerError) {
        console.error(
          `[generateDailyPuzzle] Failed to schedule composition optimization for puzzle ${puzzleId}:`,
          schedulerError,
        );
      }
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
 * Compute the allowed date window for ensure operations
 * Window: [yesterdayUTC, tomorrowUTC] - covers all timezone scenarios
 *
 * @returns Array of allowed date strings
 */
function getAllowedDateWindow(): string[] {
  const now = new Date();

  // Yesterday UTC
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Today UTC
  const todayStr = now.toISOString().slice(0, 10);

  // Tomorrow UTC
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  return [yesterdayStr, todayStr, tomorrowStr];
}

/**
 * Check if a date is within the allowed ensure window
 *
 * @param date - Date string (YYYY-MM-DD) to check
 * @returns True if date is in allowed window
 */
function isDateInAllowedWindow(date: string): boolean {
  const allowedDates = getAllowedDateWindow();
  return allowedDates.includes(date);
}

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

    // Schedule puzzle composition optimization (non-blocking)
    if (isPuzzleJudgeEnabled()) {
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.puzzleComposition.optimizePuzzle.optimizePuzzleComposition,
          {
            puzzleId,
            year: selectedYear,
            events: selectedEvents.map((e) => e.event),
          },
        );
      } catch (schedulerError) {
        console.error(
          `[ensureTodaysPuzzle] Failed to schedule composition optimization:`,
          schedulerError,
        );
      }
    }

    const newPuzzle = await ctx.db.get(puzzleId);

    console.warn(`Created puzzle #${nextPuzzleNumber} for ${today} with year ${selectedYear}`);

    return { status: "created", puzzle: newPuzzle };
  },
});

/**
 * Public mutation to ensure a puzzle exists for a specific date
 *
 * Supports local-date puzzle unlock: client passes their local date,
 * server creates the puzzle if it doesn't exist and date is in allowed window.
 *
 * Window Guard: Only accepts dates in [yesterdayUTC, tomorrowUTC] to prevent
 * far-future requests (anti-cheat) while supporting all timezone scenarios.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Status and puzzle data, or error if date outside window
 */
export const ensurePuzzleForDate = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    // Window guard: reject dates outside [yesterdayUTC, tomorrowUTC]
    if (!isDateInAllowedWindow(date)) {
      console.error(`[ensurePuzzleForDate] Date ${date} outside allowed window, rejecting`);
      throw new Error("Date out of allowed window");
    }

    // Check if puzzle already exists
    const existingPuzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existingPuzzle) {
      return { status: "already_exists" as const, puzzle: existingPuzzle };
    }

    // Generate puzzle for the requested date
    console.warn(`[ensurePuzzleForDate] Generating puzzle for ${date}`);

    // Get the highest puzzle number
    const latestPuzzle = await ctx.db.query("puzzles").order("desc").first();
    const nextPuzzleNumber = (latestPuzzle?.puzzleNumber || 0) + 1;

    // Select a year with 6+ unused events and get random events from it
    const { year: selectedYear, events: selectedEvents } = await selectYearForPuzzle(ctx);

    const puzzleId = await ctx.db.insert("puzzles", {
      puzzleNumber: nextPuzzleNumber,
      date: date,
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

    // Schedule puzzle composition optimization (non-blocking)
    if (isPuzzleJudgeEnabled()) {
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.puzzleComposition.optimizePuzzle.optimizePuzzleComposition,
          {
            puzzleId,
            year: selectedYear,
            events: selectedEvents.map((e) => e.event),
          },
        );
      } catch (schedulerError) {
        console.error(
          `[ensurePuzzleForDate] Failed to schedule composition optimization:`,
          schedulerError,
        );
      }
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
      console.error(
        `[ensurePuzzleForDate] Failed to schedule context generation for puzzle ${puzzleId}:`,
        schedulerError,
      );
    }

    const newPuzzle = await ctx.db.get(puzzleId);

    console.warn(`Created puzzle #${nextPuzzleNumber} for ${date} with year ${selectedYear}`);

    return { status: "created" as const, puzzle: newPuzzle };
  },
});

/**
 * Internal mutation to pre-generate tomorrow's puzzle
 *
 * Called by cron to ensure ahead-UTC timezone users have their puzzle ready.
 * Delegates to generateDailyPuzzle with tomorrow's UTC date.
 */
export const generateTomorrowPuzzle = internalMutation({
  handler: async (ctx) => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);

    console.warn(`[generateTomorrowPuzzle] Pre-generating puzzle for ${tomorrowDate}`);

    // Check if puzzle already exists
    const existingPuzzle = await ctx.db
      .query("puzzles")
      .withIndex("by_date", (q) => q.eq("date", tomorrowDate))
      .first();

    if (existingPuzzle) {
      console.warn(`[generateTomorrowPuzzle] Puzzle for ${tomorrowDate} already exists`);
      return { status: "already_exists", puzzle: existingPuzzle };
    }

    // Get the highest puzzle number
    const latestPuzzle = await ctx.db.query("puzzles").order("desc").first();
    const nextPuzzleNumber = (latestPuzzle?.puzzleNumber || 0) + 1;

    // Select a year with 6+ unused events
    const { year: selectedYear, events: selectedEvents } = await selectYearForPuzzle(ctx);

    const puzzleId = await ctx.db.insert("puzzles", {
      puzzleNumber: nextPuzzleNumber,
      date: tomorrowDate,
      targetYear: selectedYear,
      events: selectedEvents.map((e) => e.event),
      playCount: 0,
      avgGuesses: 0,
      updatedAt: Date.now(),
    });

    // Mark events as used
    for (const event of selectedEvents) {
      await ctx.db.patch(event._id, {
        classicPuzzleId: puzzleId,
        updatedAt: Date.now(),
      });
    }

    // Schedule puzzle composition optimization (non-blocking)
    if (isPuzzleJudgeEnabled()) {
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.puzzleComposition.optimizePuzzle.optimizePuzzleComposition,
          {
            puzzleId,
            year: selectedYear,
            events: selectedEvents.map((e) => e.event),
          },
        );
      } catch (schedulerError) {
        console.error(
          `[generateTomorrowPuzzle] Failed to schedule composition optimization:`,
          schedulerError,
        );
      }
    }

    // Schedule historical context generation
    try {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.historicalContext.generateHistoricalContext,
        {
          puzzleId,
          year: selectedYear,
          events: selectedEvents.map((e) => e.event),
        },
      );
    } catch (schedulerError) {
      console.error(
        `[generateTomorrowPuzzle] Failed to schedule context generation:`,
        schedulerError,
      );
    }

    console.warn(
      `[generateTomorrowPuzzle] Created puzzle #${nextPuzzleNumber} for ${tomorrowDate}`,
    );

    return { status: "created", puzzleId, date: tomorrowDate };
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
