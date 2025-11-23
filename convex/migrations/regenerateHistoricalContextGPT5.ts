// Migration Script: Regenerate All Historical Context with GPT-5
// Updates all existing puzzles with new GPT-5 generated historical context in BC/AD format

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Migration to regenerate all historical context using GPT-5 model
 *
 * Features:
 * - Queries ALL puzzles for regeneration (not just missing context)
 * - Updates existing context with GPT-5 generated content
 * - Enforces BC/AD date format consistently
 * - Batch processing with GPT-5 rate limit handling
 * - Migration metadata tracking
 * - Rollback snapshot reminder
 *
 * Usage:
 * - Create backup first: npx convex export --path ./backups/pre-gpt5-migration-$(date +%s).zip
 * - Dry run: regenerateHistoricalContextGPT5({ dryRun: true })
 * - Single test: regenerateHistoricalContextGPT5({ testMode: true, testPuzzleNumber: 1 })
 * - Full migration: regenerateHistoricalContextGPT5({ batchSize: 5, delayMs: 3000 })
 */
export const regenerateHistoricalContextGPT5 = internalMutation({
  args: {
    // Processing options
    batchSize: v.optional(v.number()), // Default: 5 puzzles per batch (GPT-5 rate limit)
    delayMs: v.optional(v.number()), // Default: 3000ms delay between batches (GPT-5 rate limit)

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
      batchSize = 5, // Reduced for GPT-5 rate limits
      delayMs = 3000, // Increased for GPT-5 rate limits
      dryRun = false,
      testMode = false,
      testPuzzleNumber,
      maxPuzzles,
      startFromPuzzle = 1,
    } = args;

    // Migration metadata
    const migrationStartedAt = new Date().toISOString();
    const previousModel = "google/gemini-2.5-flash";
    const newModel = "openai/gpt-5";

    console.error(`[GPT5-Migration] Starting GPT-5 historical context regeneration`);
    console.error(
      `[GPT5-Migration] Config: batchSize=${batchSize}, delayMs=${delayMs}, dryRun=${dryRun}, testMode=${testMode}`,
    );
    console.error(`[GPT5-Migration] Models: ${previousModel} → ${newModel}`);

    try {
      // Query ALL puzzles for regeneration (not just missing context)
      let puzzlesQuery = ctx.db.query("puzzles");

      // Apply puzzle number filtering if specified
      if (startFromPuzzle > 1) {
        puzzlesQuery = puzzlesQuery.filter((q) => q.gte(q.field("puzzleNumber"), startFromPuzzle));
      }

      // Order by puzzle number ascending for consistent processing
      const allPuzzles = await puzzlesQuery.collect();
      const sortedPuzzles = allPuzzles
        .sort((a, b) => a.puzzleNumber - b.puzzleNumber)
        .slice(0, maxPuzzles || allPuzzles.length);

      console.error(
        `[GPT5-Migration] Found ${sortedPuzzles.length} puzzles to regenerate with GPT-5`,
      );

      if (sortedPuzzles.length === 0) {
        console.error(`[GPT5-Migration] No puzzles found for regeneration`);
        return {
          success: true,
          message: "No puzzles found for regeneration",
          stats: {
            totalFound: 0,
            processed: 0,
            scheduled: 0,
            errors: 0,
            migrationStartedAt,
            migrationCompletedAt: new Date().toISOString(),
            previousModel,
            newModel,
          },
        };
      }

      // Dry run mode - just count and report
      if (dryRun) {
        console.error(
          `[GPT5-Migration] DRY RUN: Would regenerate context for ${sortedPuzzles.length} puzzles`,
        );
        console.error(
          `[GPT5-Migration] DRY RUN: Would create ${Math.ceil(sortedPuzzles.length / batchSize)} batches`,
        );
        console.error(
          `[GPT5-Migration] DRY RUN: Estimated total time: ${Math.ceil(sortedPuzzles.length / batchSize) * (delayMs / 1000)} seconds`,
        );

        // Estimate GPT-5 API costs (rough estimate)
        const estimatedTokensPerPuzzle = 1500; // Input + output estimate
        const totalTokens = sortedPuzzles.length * estimatedTokensPerPuzzle;
        const estimatedCost = (totalTokens / 1000) * 0.04; // $0.01 input + $0.03 output per 1K tokens
        console.error(
          `[GPT5-Migration] DRY RUN: Estimated API cost: ~$${estimatedCost.toFixed(2)} USD`,
        );

        // Show sample of puzzles that would be processed
        const samplePuzzles = sortedPuzzles.slice(0, 5);
        console.error(
          `[GPT5-Migration] DRY RUN: Sample puzzles to regenerate:`,
          samplePuzzles.map((p) => ({
            puzzleNumber: p.puzzleNumber,
            date: p.date,
            targetYear: p.targetYear,
            hasExistingContext: !!p.historicalContext,
            eventsCount: p.events.length,
          })),
        );

        return {
          success: true,
          message: `Dry run completed: ${sortedPuzzles.length} puzzles would be regenerated`,
          stats: {
            totalFound: sortedPuzzles.length,
            processed: 0,
            scheduled: 0,
            errors: 0,
            batches: Math.ceil(sortedPuzzles.length / batchSize),
            estimatedTimeSeconds: Math.ceil(sortedPuzzles.length / batchSize) * (delayMs / 1000),
            estimatedCostUSD: estimatedCost,
            migrationStartedAt,
            migrationCompletedAt: new Date().toISOString(),
            previousModel,
            newModel,
          },
        };
      }

      // Test mode - process only one puzzle
      if (testMode) {
        let testPuzzle;
        if (testPuzzleNumber) {
          testPuzzle = sortedPuzzles.find((p) => p.puzzleNumber === testPuzzleNumber);
          if (!testPuzzle) {
            throw new Error(`Test puzzle number ${testPuzzleNumber} not found`);
          }
        } else {
          testPuzzle = sortedPuzzles[0];
        }

        console.error(
          `[GPT5-Migration] TEST MODE: Regenerating puzzle ${testPuzzle.puzzleNumber} (year ${testPuzzle.targetYear}) with GPT-5`,
        );
        console.error(
          `[GPT5-Migration] TEST MODE: Existing context length: ${testPuzzle.historicalContext?.length || 0} chars`,
        );

        try {
          // Schedule context regeneration immediately for test
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
            `[GPT5-Migration] TEST MODE: Successfully scheduled GPT-5 regeneration for puzzle ${testPuzzle.puzzleNumber}`,
          );

          return {
            success: true,
            message: `Test mode: Successfully scheduled GPT-5 regeneration for puzzle ${testPuzzle.puzzleNumber}`,
            stats: {
              totalFound: sortedPuzzles.length,
              processed: 1,
              scheduled: 1,
              errors: 0,
              testPuzzle: {
                puzzleNumber: testPuzzle.puzzleNumber,
                date: testPuzzle.date,
                targetYear: testPuzzle.targetYear,
                hasExistingContext: !!testPuzzle.historicalContext,
                eventsCount: testPuzzle.events.length,
              },
              migrationStartedAt,
              migrationCompletedAt: new Date().toISOString(),
              previousModel,
              newModel,
            },
          };
        } catch (error) {
          console.error(
            `[GPT5-Migration] TEST MODE: Failed to schedule regeneration for puzzle ${testPuzzle.puzzleNumber}:`,
            error,
          );
          throw error;
        }
      }

      // Full migration mode - process all puzzles in batches
      console.error(
        `[GPT5-Migration] FULL MODE: Regenerating ${sortedPuzzles.length} puzzles with GPT-5 in batches of ${batchSize}`,
      );

      let processed = 0;
      let scheduled = 0;
      let errors = 0;
      const failedPuzzles: number[] = [];
      const totalBatches = Math.ceil(sortedPuzzles.length / batchSize);

      // Process puzzles in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, sortedPuzzles.length);
        const batch = sortedPuzzles.slice(batchStart, batchEnd);
        const batchNumber = batchIndex + 1;

        console.error(
          `[GPT5-Migration] Processing batch ${batchNumber}/${totalBatches} (${batch.length} puzzles)`,
        );

        // Schedule context regeneration for each puzzle in the batch
        for (const puzzle of batch) {
          try {
            // Calculate delay for this puzzle (spread out within batch)
            const puzzleDelay = batchIndex * delayMs + batch.indexOf(puzzle) * 600; // 600ms between puzzles in batch (increased for GPT-5)

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
              `[GPT5-Migration] Scheduled puzzle #${puzzle.puzzleNumber} (year: ${puzzle.targetYear}) with ${puzzleDelay}ms delay`,
            );
          } catch (error) {
            errors++;
            failedPuzzles.push(puzzle.puzzleNumber);
            console.error(
              `[GPT5-Migration] Failed to schedule puzzle ${puzzle.puzzleNumber}:`,
              error,
            );
          }

          processed++;
        }

        // Progress update
        const progressPercent = Math.round((processed / sortedPuzzles.length) * 100);
        console.error(
          `[GPT5-Migration] Progress: ${processed}/${sortedPuzzles.length} puzzles processed (${progressPercent}%), ${scheduled} scheduled, ${errors} errors`,
        );
      }

      // Log failed puzzles for retry
      if (failedPuzzles.length > 0) {
        console.error(
          `[GPT5-Migration] Failed puzzles for manual retry: ${failedPuzzles.join(", ")}`,
        );
      }

      const migrationCompletedAt = new Date().toISOString();
      const finalStats = {
        totalFound: sortedPuzzles.length,
        processed,
        scheduled,
        errors,
        failedPuzzles,
        batches: totalBatches,
        estimatedCompletionTimeSeconds: (totalBatches * delayMs) / 1000,
        migrationStartedAt,
        migrationCompletedAt,
        previousModel,
        newModel,
      };

      console.error(`[GPT5-Migration] Migration scheduling completed:`, finalStats);

      if (errors > 0) {
        console.error(
          `[GPT5-Migration] WARNING: ${errors} puzzles failed to schedule. Check logs above for details.`,
        );
        console.error(
          `[GPT5-Migration] To retry failed puzzles, run with specific puzzle numbers: ${failedPuzzles.join(", ")}`,
        );
      }

      return {
        success: errors === 0,
        message: `GPT-5 migration scheduled: ${scheduled}/${processed} puzzles queued for regeneration`,
        stats: finalStats,
      };
    } catch (error) {
      console.error(`[GPT5-Migration] Migration failed:`, error);
      throw error;
    }
  },
});
