// Migration Script: Generate Historical Context for Existing Puzzles
// Backfills historical context for puzzles created before server-side generation

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Migration to generate missing historical context for existing puzzles
 *
 * Features:
 * - Queries puzzles missing historicalContext field
 * - Batch processing to avoid overwhelming OpenRouter API
 * - Scheduled generation with delays between batches
 * - Progress logging and dry-run mode
 * - Single puzzle testing capability
 *
 * Usage:
 * - Dry run: generateMissingContext({ dryRun: true })
 * - Single test: generateMissingContext({ testMode: true, testPuzzleNumber: 1 })
 * - Full migration: generateMissingContext({ batchSize: 5, delayMs: 2000 })
 */
export const generateMissingContext = internalMutation({
  args: {
    // Processing options
    batchSize: v.optional(v.number()), // Default: 5 puzzles per batch
    delayMs: v.optional(v.number()), // Default: 2000ms delay between batches

    // Testing and safety options
    dryRun: v.optional(v.boolean()), // Count puzzles without processing
    testMode: v.optional(v.boolean()), // Process only one puzzle for testing
    testPuzzleNumber: v.optional(v.number()), // Specific puzzle number to test

    // Filtering options
    maxPuzzles: v.optional(v.number()), // Limit total puzzles processed
    startFromPuzzle: v.optional(v.number()), // Start from specific puzzle number
  },

  handler: async (ctx, args) => {
    const {
      batchSize = 5,
      delayMs = 2000,
      dryRun = false,
      testMode = false,
      testPuzzleNumber,
      maxPuzzles,
      startFromPuzzle = 1,
    } = args;

    console.error(`[Migration] Starting historical context generation migration`);
    console.error(
      `[Migration] Config: batchSize=${batchSize}, delayMs=${delayMs}, dryRun=${dryRun}, testMode=${testMode}`,
    );

    try {
      // Query all puzzles missing historical context
      let puzzlesQuery = ctx.db
        .query("puzzles")
        .filter((q) => q.eq(q.field("historicalContext"), undefined));

      // Apply puzzle number filtering if specified
      if (startFromPuzzle > 1) {
        puzzlesQuery = puzzlesQuery.filter((q) => q.gte(q.field("puzzleNumber"), startFromPuzzle));
      }

      // Order by puzzle number ascending for consistent processing
      const allPuzzles = await puzzlesQuery.collect();
      const sortedPuzzles = allPuzzles
        .sort((a, b) => a.puzzleNumber - b.puzzleNumber)
        .slice(0, maxPuzzles || allPuzzles.length);

      console.error(`[Migration] Found ${sortedPuzzles.length} puzzles missing historical context`);

      if (sortedPuzzles.length === 0) {
        console.error(`[Migration] No puzzles found needing historical context generation`);
        return {
          success: true,
          message: "No puzzles need historical context generation",
          stats: {
            totalFound: 0,
            processed: 0,
            scheduled: 0,
            errors: 0,
          },
        };
      }

      // Dry run mode - just count and report
      if (dryRun) {
        console.error(`[Migration] DRY RUN: Would process ${sortedPuzzles.length} puzzles`);
        console.error(
          `[Migration] DRY RUN: Would create ${Math.ceil(sortedPuzzles.length / batchSize)} batches`,
        );
        console.error(
          `[Migration] DRY RUN: Estimated total time: ${Math.ceil(sortedPuzzles.length / batchSize) * (delayMs / 1000)} seconds`,
        );

        // Show sample of puzzles that would be processed
        const samplePuzzles = sortedPuzzles.slice(0, 5);
        console.error(
          `[Migration] DRY RUN: Sample puzzles to process:`,
          samplePuzzles.map((p) => ({
            puzzleNumber: p.puzzleNumber,
            date: p.date,
            targetYear: p.targetYear,
            eventsCount: p.events.length,
          })),
        );

        return {
          success: true,
          message: `Dry run completed: ${sortedPuzzles.length} puzzles would be processed`,
          stats: {
            totalFound: sortedPuzzles.length,
            processed: 0,
            scheduled: 0,
            errors: 0,
            batches: Math.ceil(sortedPuzzles.length / batchSize),
            estimatedTimeSeconds: Math.ceil(sortedPuzzles.length / batchSize) * (delayMs / 1000),
          },
        };
      }

      // Test mode - process only one puzzle
      if (testMode) {
        let testPuzzle;
        if (testPuzzleNumber) {
          testPuzzle = sortedPuzzles.find((p) => p.puzzleNumber === testPuzzleNumber);
          if (!testPuzzle) {
            throw new Error(
              `Test puzzle number ${testPuzzleNumber} not found in missing context puzzles`,
            );
          }
        } else {
          testPuzzle = sortedPuzzles[0];
        }

        console.error(
          `[Migration] TEST MODE: Processing single puzzle ${testPuzzle.puzzleNumber} (year ${testPuzzle.targetYear})`,
        );

        try {
          // Schedule context generation immediately for test
          await ctx.scheduler.runAfter(
            0, // Run immediately
            internal.actions.historicalContext.generateHistoricalContext,
            {
              puzzleId: testPuzzle._id,
              year: testPuzzle.targetYear,
              events: testPuzzle.events,
            },
          );

          console.error(
            `[Migration] TEST MODE: Successfully scheduled context generation for puzzle ${testPuzzle.puzzleNumber}`,
          );

          return {
            success: true,
            message: `Test mode: Successfully scheduled context generation for puzzle ${testPuzzle.puzzleNumber}`,
            stats: {
              totalFound: sortedPuzzles.length,
              processed: 1,
              scheduled: 1,
              errors: 0,
              testPuzzle: {
                puzzleNumber: testPuzzle.puzzleNumber,
                date: testPuzzle.date,
                targetYear: testPuzzle.targetYear,
                eventsCount: testPuzzle.events.length,
              },
            },
          };
        } catch (error) {
          console.error(
            `[Migration] TEST MODE: Failed to schedule context generation for puzzle ${testPuzzle.puzzleNumber}:`,
            error,
          );
          throw error;
        }
      }

      // Full migration mode - process all puzzles in batches
      console.error(
        `[Migration] FULL MODE: Processing ${sortedPuzzles.length} puzzles in batches of ${batchSize}`,
      );

      let processed = 0;
      let scheduled = 0;
      let errors = 0;
      const totalBatches = Math.ceil(sortedPuzzles.length / batchSize);

      // Process puzzles in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, sortedPuzzles.length);
        const batch = sortedPuzzles.slice(batchStart, batchEnd);
        const batchNumber = batchIndex + 1;

        console.error(
          `[Migration] Processing batch ${batchNumber}/${totalBatches} (${batch.length} puzzles)`,
        );

        // Schedule context generation for each puzzle in the batch
        for (const puzzle of batch) {
          try {
            // Calculate delay for this puzzle (spread out within batch)
            const puzzleDelay = batchIndex * delayMs + batch.indexOf(puzzle) * 500; // 500ms between puzzles in batch

            await ctx.scheduler.runAfter(
              puzzleDelay,
              internal.actions.historicalContext.generateHistoricalContext,
              {
                puzzleId: puzzle._id,
                year: puzzle.targetYear,
                events: puzzle.events,
              },
            );

            scheduled++;
            console.error(
              `[Migration] Scheduled puzzle ${puzzle.puzzleNumber} (year ${puzzle.targetYear}) with ${puzzleDelay}ms delay`,
            );
          } catch (error) {
            errors++;
            console.error(`[Migration] Failed to schedule puzzle ${puzzle.puzzleNumber}:`, error);
          }

          processed++;
        }

        // Progress update
        const progressPercent = Math.round((processed / sortedPuzzles.length) * 100);
        console.error(
          `[Migration] Progress: ${processed}/${sortedPuzzles.length} puzzles processed (${progressPercent}%), ${scheduled} scheduled, ${errors} errors`,
        );
      }

      const finalStats = {
        totalFound: sortedPuzzles.length,
        processed,
        scheduled,
        errors,
        batches: totalBatches,
        estimatedCompletionTimeSeconds: (totalBatches * delayMs) / 1000,
      };

      console.error(`[Migration] Migration scheduling completed:`, finalStats);

      if (errors > 0) {
        console.error(
          `[Migration] WARNING: ${errors} puzzles failed to schedule. Check logs above for details.`,
        );
      }

      return {
        success: errors === 0,
        message: `Migration scheduled: ${scheduled}/${processed} puzzles queued for context generation`,
        stats: finalStats,
      };
    } catch (error) {
      console.error(`[Migration] Migration failed:`, error);
      throw error;
    }
  },
});
