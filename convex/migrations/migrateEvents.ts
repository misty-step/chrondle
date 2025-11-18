"use node";

import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";

// Define the puzzle data structure
interface PuzzleData {
  meta: {
    version: string;
    total_puzzles: number;
    date_range: string;
  };
  puzzles: {
    [year: string]: string[];
  };
}

// Import events from puzzles.json data into the events table
export const migrateEvents = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting event migration...");

    // In production, you would fetch this data from an external source
    // For now, we'll use the hardcoded puzzle data
    const puzzleData: PuzzleData = {
      meta: {
        version: "4.4",
        total_puzzles: 298,
        date_range: "-2000-2025",
      },
      puzzles: {}, // This will be populated from puzzles.json
    };

    // Get all years from puzzle data and sort them chronologically
    const years = Object.keys(puzzleData.puzzles)
      .map((year) => parseInt(year))
      .sort((a, b) => a - b);

    let totalEvents = 0;
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    console.log(`Found ${years.length} years to process`);

    for (const year of years) {
      const events = puzzleData.puzzles[year.toString()];

      if (!Array.isArray(events)) {
        console.warn(`Skipping year ${year}: invalid events data`);
        errorCount++;
        errors.push(`Year ${year}: invalid events data`);
        continue;
      }

      console.log(`Processing year ${year} with ${events.length} events`);

      try {
        // Import all events for this year
        const result = await ctx.runMutation(internal.events.importYearEvents, {
          year,
          events,
        });

        totalEvents += result.total;
        successCount += result.created;
        skippedCount += result.skipped;

        // Log progress every 10 years
        if (years.indexOf(year) % 10 === 0) {
          console.log(`Progress: Processed ${years.indexOf(year) + 1}/${years.length} years`);
        }

        // Add a small delay to avoid overwhelming the database
        if (years.indexOf(year) % 20 === 0 && years.indexOf(year) > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error importing events for year ${year}:`, error);
        errorCount++;
        errors.push(`Year ${year}: ${error}`);
      }
    }

    const summary = {
      totalYears: years.length,
      totalEvents,
      successfullyImported: successCount,
      skipped: skippedCount,
      errors: errorCount,
      errorDetails: errors,
    };

    console.log("\nMigration completed!");
    console.log(`Total events processed: ${totalEvents}`);
    console.log(`Successfully imported: ${successCount} events`);
    console.log(`Skipped (already exist): ${skippedCount} events`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log("\nError details:");
      errors.forEach((error) => console.log(`  - ${error}`));
    }

    // Get pool statistics
    const poolStats = await ctx.runQuery(api.events.getEventPoolStats);
    console.log("\nEvent pool statistics:");
    console.log(`  - Total events in database: ${poolStats.totalEvents}`);
    console.log(`  - Unique years: ${poolStats.uniqueYears}`);
    console.log(`  - Years available for puzzles: ${poolStats.availableYearsForPuzzles}`);

    return summary;
  },
});

// Helper action to migrate from external data source
export const migrateFromJSON = internalAction({
  args: {},
  handler: async () => {
    // This would typically fetch from an external source
    // For the actual migration, we'll need to run a script that calls this
    // with the puzzle data from puzzles.json

    console.log("This action needs to be called with puzzle data.");
    console.log("Use the migration script in scripts/migrate-events-to-convex.mjs");

    return {
      message: "Please use the migration script to import puzzle data",
    };
  },
});
