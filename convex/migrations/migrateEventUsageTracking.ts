/**
 * Migration: Event Usage Tracking Per-Mode
 *
 * Backfills `classicPuzzleId` from deprecated `puzzleId` field.
 * Run once after schema migration to copy existing Classic mode usage data.
 *
 * Usage:
 *   npx convex run migrations/migrateEventUsageTracking:backfillClassicPuzzleId --prod
 *
 * The migration processes in batches to avoid timeout. Re-run until it reports
 * "Migration complete" - safe to run multiple times (idempotent).
 */
import { internalMutation } from "../_generated/server";

const BATCH_SIZE = 100;

/**
 * Backfill classicPuzzleId from puzzleId for all events.
 * Idempotent - only updates events where classicPuzzleId is undefined but puzzleId exists.
 */
export const backfillClassicPuzzleId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find events with puzzleId set but classicPuzzleId not yet set
    const events = await ctx.db
      .query("events")
      .filter((q) =>
        q.and(q.neq(q.field("puzzleId"), undefined), q.eq(q.field("classicPuzzleId"), undefined)),
      )
      .take(BATCH_SIZE);

    if (events.length === 0) {
      console.log(
        "[Migration] Complete: All events with puzzleId have been migrated to classicPuzzleId",
      );
      return { status: "complete", migrated: 0 };
    }

    // Update each event
    let migratedCount = 0;
    for (const event of events) {
      if (event.puzzleId !== undefined) {
        await ctx.db.patch(event._id, {
          classicPuzzleId: event.puzzleId,
          updatedAt: Date.now(),
        });
        migratedCount++;
      }
    }

    console.log(`[Migration] Migrated ${migratedCount} events. Run again if more remain.`);
    return { status: "partial", migrated: migratedCount };
  },
});

/**
 * Verify migration integrity - check that all puzzleId values match classicPuzzleId.
 */
export const verifyMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const eventsWithPuzzleId = await ctx.db
      .query("events")
      .filter((q) => q.neq(q.field("puzzleId"), undefined))
      .collect();

    let mismatches = 0;
    let notMigrated = 0;

    for (const event of eventsWithPuzzleId) {
      if (event.classicPuzzleId === undefined) {
        notMigrated++;
      } else if (event.classicPuzzleId !== event.puzzleId) {
        mismatches++;
        console.warn(
          `[Migration] Mismatch: Event ${event._id} has puzzleId=${event.puzzleId} but classicPuzzleId=${event.classicPuzzleId}`,
        );
      }
    }

    const result = {
      totalWithPuzzleId: eventsWithPuzzleId.length,
      notMigrated,
      mismatches,
      integrity: mismatches === 0 && notMigrated === 0 ? "PASS" : "FAIL",
    };

    console.log("[Migration] Verification result:", result);
    return result;
  },
});

/**
 * Get migration status - counts for dashboard visibility.
 */
export const getMigrationStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("events").collect();

    const withPuzzleId = allEvents.filter((e) => e.puzzleId !== undefined).length;
    const withClassicPuzzleId = allEvents.filter((e) => e.classicPuzzleId !== undefined).length;
    const withOrderPuzzleId = allEvents.filter((e) => e.orderPuzzleId !== undefined).length;
    const unusedBothModes = allEvents.filter(
      (e) => e.classicPuzzleId === undefined && e.orderPuzzleId === undefined,
    ).length;

    return {
      totalEvents: allEvents.length,
      withPuzzleId,
      withClassicPuzzleId,
      withOrderPuzzleId,
      unusedBothModes,
      migrationNeeded: withPuzzleId - withClassicPuzzleId,
    };
  },
});
