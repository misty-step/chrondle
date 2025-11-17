#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Command } from "commander";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "../convex/_generated/api.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env.local");

async function loadEnv() {
  try {
    const envContent = await fs.readFile(envPath, "utf-8");
    const envVars = dotenv.parse(envContent);
    Object.assign(process.env, envVars);
  } catch (error: any) {
    console.error("Error loading .env.local:", error.message);
    process.exit(1);
  }
}

// Initialize Convex client
async function getConvexClient(): Promise<ConvexHttpClient> {
  await loadEnv();

  const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!CONVEX_URL) {
    console.error("NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
    process.exit(1);
  }

  return new ConvexHttpClient(CONVEX_URL);
}

// Create the CLI program
const program = new Command();

program
  .name("manage-events")
  .description("CLI tool for managing Chrondle historical events in Convex")
  .version("1.0.0");

// Add command: Add events for a year
program
  .command("add")
  .description("Add events for a specific year")
  .requiredOption("-y, --year <year>", "Year to add events for", parseInt)
  .requiredOption("-e, --events <events...>", "List of 6 historical events")
  .option("-f, --force", "Force adding events even if year already exists")
  .action(async (options) => {
    const { year, events, force } = options;

    // Validate year range
    if (year < -2000 || year > 2025) {
      console.error(`❌ Error: Year must be between -2000 and 2025. Got: ${year}`);
      process.exit(1);
    }

    // Validate event count
    if (events.length !== 6) {
      console.error(`❌ Error: Exactly 6 events required. Got: ${events.length}`);
      process.exit(1);
    }

    try {
      const client = await getConvexClient();

      // Check if year already has events
      const existingEvents = await client.query(api.events.getYearEvents, {
        year,
      });

      if (existingEvents.length > 0 && !force) {
        console.error(
          `❌ Error: Year ${year} already exists with ${existingEvents.length} events.`,
        );
        console.error(`\n💡 Options:`);
        console.error(`   1. Use 'pnpm events show ${year}' to review existing events`);
        console.error(
          `   2. Use 'pnpm events add-one -y ${year} -e "..."' to add individual events`,
        );
        console.error(
          `   3. Use 'pnpm events add -y ${year} -e ... --force' to force adding (creates duplicates)`,
        );
        process.exit(1);
      }

      if (existingEvents.length >= 6 && force) {
        console.warn(
          `⚠️  Warning: Year ${year} already has ${existingEvents.length} events. Adding more...`,
        );
      }

      // Import the events
      console.log(`Adding ${events.length} events for year ${year}...`);
      // @ts-expect-error - ConvexHttpClient doesn't support internal mutations (needs wrapper action)
      const result = await client.mutation(internal.events.importYearEvents, {
        year,
        events,
      });

      // Show results
      if (result.created > 0) {
        console.log(`✅ Year ${year}: Imported ${result.created} new events`);
      }
      if (result.skipped > 0) {
        console.log(`ℹ️  Skipped ${result.skipped} duplicate events`);
      }

      // Show total events for the year
      const totalEvents = existingEvents.length + result.created;
      console.log(`📊 Total events for year ${year}: ${totalEvents}`);
    } catch (error: any) {
      console.error(`❌ Error adding events:`, error.message);
      process.exit(1);
    }
  });

// Update command: Update events for a year (with protection)
program
  .command("update")
  .description("Update events for a specific year (only if not used in puzzles)")
  .requiredOption("-y, --year <year>", "Year to update events for", parseInt)
  .requiredOption("-e, --events <events...>", "List of 6 historical events")
  .action(async (options) => {
    const { year, events } = options;

    // Validate year range
    if (year < -2000 || year > 2025) {
      console.error(`❌ Error: Year must be between -2000 and 2025. Got: ${year}`);
      process.exit(1);
    }

    // Validate event count
    if (events.length !== 6) {
      console.error(`❌ Error: Exactly 6 events required. Got: ${events.length}`);
      process.exit(1);
    }

    try {
      const client = await getConvexClient();

      // Check if any events for this year are used in puzzles
      const existingEvents = await client.query(api.events.getYearEvents, {
        year,
      });
      const usedEvents = existingEvents.filter((e: any) => e.puzzleId !== undefined);

      if (usedEvents.length > 0) {
        console.error(`❌ Cannot update year ${year}: some events already published in puzzles`);
        console.error(`   ${usedEvents.length} event(s) are currently in use`);
        process.exit(1);
      }

      // Safe to update - delete old events and add new ones
      console.log(`🔄 Updating events for year ${year}...`);

      // Delete existing events
      if (existingEvents.length > 0) {
        try {
          // @ts-expect-error - ConvexHttpClient doesn't support internal mutations (needs wrapper action)
          const deleteResult = await client.mutation(internal.events.deleteYearEvents, { year });
          console.log(`🗑️  Deleted ${deleteResult.deletedCount} old events`);
        } catch {
          // Fallback: show what would happen
          console.log(
            `⚠️  Delete mutation not available. Would delete ${existingEvents.length} events`,
          );
          console.log(`⚠️  Note: Run 'convex dev' or 'convex deploy' to enable deletion`);
        }
      }

      // Add new events
      // @ts-expect-error - ConvexHttpClient doesn't support internal mutations (needs wrapper action)
      const addResult = await client.mutation(internal.events.importYearEvents, {
        year,
        events,
      });

      console.log(`✅ Year ${year}: Successfully updated with ${addResult.created} new events`);
    } catch (error: any) {
      console.error(`❌ Error updating events:`, error.message);

      // If it's a deletion protection error, show a cleaner message
      if (error.message.includes("Cannot delete events")) {
        console.error(`   Some events for year ${year} are already used in puzzles`);
      }

      process.exit(1);
    }
  });

// Add one command
program
  .command("add-one")
  .description("Add a single event to a year")
  .requiredOption("-y, --year <year>", "Year to add event to", parseInt)
  .requiredOption("-e, --event <event>", "The event text to add")
  .action(async ({ year, event }) => {
    try {
      const client = await getConvexClient();
      // @ts-expect-error - ConvexHttpClient doesn't support internal mutations (needs wrapper action)
      const result = await client.mutation(internal.events.importEvent, {
        year,
        event,
      });
      if (result.skipped) {
        console.log(`Skipped: Event already exists for year ${year}.`);
      } else {
        console.log(`Successfully added event to year ${year}.`);
      }
    } catch (error: any) {
      console.error("Error adding event:", error.message);
      process.exit(1);
    }
  });

// Update one command
program
  .command("update-one")
  .description("Update a single event")
  .requiredOption("-y, --year <year>", "Year of the event to update", parseInt)
  .requiredOption(
    "-n, --number <number>",
    "The event number to update (from 'show' command)",
    parseInt,
  )
  .requiredOption("-t, --text <text>", "The new event text")
  .action(async ({ year, number, text }) => {
    try {
      const client = await getConvexClient();
      const events = await client.query(api.events.getYearEvents, { year });
      if (number <= 0 || number > events.length) {
        console.error(`❌ Invalid event number. Use 'show ${year}' to see available events.`);
        process.exit(1);
      }
      const eventToUpdate = events[number - 1];
      // @ts-expect-error - ConvexHttpClient doesn't support internal mutations (needs wrapper action)
      await client.mutation(internal.events.updateEvent, {
        eventId: eventToUpdate._id,
        newEvent: text,
      });
      console.log(`✅ Successfully updated event #${number} for year ${year}.`);
    } catch (error: any) {
      console.error("❌ Error updating event:", error.message);

      // Provide more helpful error messages
      if (error.message.includes("Could not find function")) {
        console.error("\n💡 Hint: The updateEvent function may not be deployed to production.");
        console.error("   Run 'npx convex deploy' to deploy the latest functions.");
      } else if (error.message.includes("already exists")) {
        console.error("\n💡 Hint: An event with this exact text already exists for this year.");
      } else if (error.message.includes("used in a puzzle")) {
        console.error(
          "\n💡 Hint: This event is already used in a published puzzle and cannot be modified.",
        );
      }

      process.exit(1);
    }
  });

// Delete one command
program
  .command("delete-one")
  .description("Delete a single event")
  .requiredOption("-y, --year <year>", "Year of the event to delete", parseInt)
  .requiredOption(
    "-n, --number <number>",
    "The event number to delete (from 'show' command)",
    parseInt,
  )
  .action(async ({ year, number }) => {
    try {
      const client = await getConvexClient();
      const events = await client.query(api.events.getYearEvents, { year });
      if (number <= 0 || number > events.length) {
        console.error(`❌ Invalid event number. Use 'show ${year}' to see available events.`);
        process.exit(1);
      }
      const eventToDelete = events[number - 1];
      // @ts-expect-error - ConvexHttpClient doesn't support internal mutations (needs wrapper action)
      await client.mutation(internal.events.deleteEvent, {
        eventId: eventToDelete._id,
      });
      console.log(`✅ Successfully deleted event #${number} for year ${year}.`);
    } catch (error: any) {
      console.error("❌ Error deleting event:", error.message);

      // Provide more helpful error messages
      if (error.message.includes("Could not find function")) {
        console.error("\n💡 Hint: The deleteEvent function may not be deployed to production.");
        console.error("   Run 'npx convex deploy' to deploy the latest functions.");
      } else if (error.message.includes("used in a puzzle")) {
        console.error(
          "\n💡 Hint: This event is already used in a published puzzle and cannot be deleted.",
        );
      } else if (error.message.includes("not found")) {
        console.error("\n💡 Hint: The event may have already been deleted.");
      }

      process.exit(1);
    }
  });

// List command: Show all years with event usage
program
  .command("list")
  .description("List all years with their event usage statistics")
  .action(async () => {
    try {
      const client = await getConvexClient();

      console.log("📊 Fetching event statistics...\n");

      const yearStats = await client.query(api.events.getAllYearsWithStats);

      if (yearStats.length === 0) {
        console.log("No events found in the database.");
        return;
      }

      // Print header
      console.log("Year  | Total | Used | Available");
      console.log("------|-------|------|----------");

      // Print each year
      for (const stats of yearStats) {
        const yearStr = stats.year.toString().padEnd(5);
        const totalStr = stats.total.toString().padEnd(5);
        const usedStr = stats.used.toString().padEnd(4);
        const availableStr = stats.available.toString().padEnd(9);

        // Color code based on availability
        let line = `${yearStr} | ${totalStr} | ${usedStr} | ${availableStr}`;

        if (stats.available >= 6) {
          // Green - enough events for a puzzle
          line = `\x1b[32m${line}\x1b[0m`;
        } else if (stats.available > 0) {
          // Yellow - some events but not enough for a puzzle
          line = `\x1b[33m${line}\x1b[0m`;
        } else {
          // Red - no available events
          line = `\x1b[31m${line}\x1b[0m`;
        }

        console.log(line);
      }

      // Summary
      console.log("\n📈 Summary:");
      const totalYears = yearStats.length;
      const yearsWithEnoughEvents = yearStats.filter((s: any) => s.available >= 6).length;
      const totalEvents = yearStats.reduce((sum: any, s: any) => sum + s.total, 0);
      const usedEvents = yearStats.reduce((sum: any, s: any) => sum + s.used, 0);

      console.log(`   Total years: ${totalYears}`);
      console.log(`   Years ready for puzzles: ${yearsWithEnoughEvents}`);
      console.log(`   Total events: ${totalEvents}`);
      console.log(
        `   Used events: ${usedEvents} (${Math.round((usedEvents / totalEvents) * 100)}%)`,
      );
    } catch (error: any) {
      console.error(`❌ Error listing events:`, error.message);
      process.exit(1);
    }
  });

// Show command: Display events for a specific year
program
  .command("show <year>")
  .description("Show all events for a specific year with their usage status")
  .action(async (yearStr) => {
    const year = parseInt(yearStr);

    // Validate year
    if (isNaN(year)) {
      console.error(`❌ Error: Invalid year. Must be a number.`);
      process.exit(1);
    }

    try {
      const client = await getConvexClient();

      console.log(`📅 Events for year ${year}:\n`);

      // Get all events for the year
      const events = await client.query(api.events.getYearEvents, { year });

      if (events.length === 0) {
        console.log(`No events found for year ${year}.`);
        return;
      }

      // Process each event to get puzzle info if needed
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        let status = "[Available]";

        if (event.puzzleId) {
          try {
            // Get puzzle details
            const puzzle = await client.query(api.puzzles.getPuzzleById, {
              puzzleId: event.puzzleId as any,
            });

            if (puzzle) {
              status = `[Used in Puzzle #${puzzle.puzzleNumber}]`;
            } else {
              status = "[Used in Unknown Puzzle]";
            }
          } catch {
            status = "[Used in Unknown Puzzle]";
          }
        }

        // Format: 1. "Event text" [Status]
        console.log(`${i + 1}. "${event.event}" ${status}`);
      }

      // Summary
      const usedCount = events.filter((e: any) => e.puzzleId).length;
      const availableCount = events.length - usedCount;

      console.log(
        `\n📊 Summary: ${events.length} total events (${usedCount} used, ${availableCount} available)`,
      );
    } catch (error: any) {
      console.error(`❌ Error showing events:`, error.message);
      process.exit(1);
    }
  });

// Verify command: Check if all functions are deployed
program
  .command("verify")
  .description("Verify that all required Convex functions are deployed")
  .action(async () => {
    try {
      const client = await getConvexClient();

      console.log("🔍 Verifying Convex function deployment...\n");

      const requiredFunctions = [
        { name: "getYearEvents", type: "query" },
        { name: "importEvent", type: "mutation" },
        { name: "importYearEvents", type: "mutation" },
        { name: "updateEvent", type: "mutation" },
        { name: "deleteEvent", type: "mutation" },
        { name: "deleteYearEvents", type: "mutation" },
        { name: "getAllYearsWithStats", type: "query" },
        { name: "getEventPoolStats", type: "query" },
      ];

      let allDeployed = true;

      for (const func of requiredFunctions) {
        try {
          // Try to verify the function exists by checking if we can call a simple query
          if (func.name === "getEventPoolStats") {
            await client.query(api.events.getEventPoolStats);
          }
          console.log(`✅ ${func.name} (${func.type})`);
        } catch (error: any) {
          if (error.message.includes("Could not find function")) {
            console.log(`❌ ${func.name} (${func.type}) - NOT DEPLOYED`);
            allDeployed = false;
          } else {
            console.log(`⚠️  ${func.name} (${func.type}) - Error checking: ${error.message}`);
          }
        }
      }

      console.log("\n" + "=".repeat(50));
      if (allDeployed) {
        console.log("✅ All required functions are deployed and ready!");
      } else {
        console.log("❌ Some functions are missing.");
        console.log("\n💡 Run 'npx convex deploy' to deploy the latest functions.");
        process.exit(1);
      }
    } catch (error: any) {
      console.error("❌ Error verifying functions:", error.message);
      process.exit(1);
    }
  });

// Validate command: Check data integrity
program
  .command("validate")
  .description("Validate all event data for integrity issues")
  .action(async () => {
    try {
      const client = await getConvexClient();

      console.log("🔍 Validating event data integrity...\n");

      let totalIssues = 0;
      const issues: string[] = [];

      // Get all year statistics
      const yearStats = await client.query(api.events.getAllYearsWithStats);

      // Check 1: All years should have at least 6 events (minimum required for puzzles)
      console.log("✓ Checking event counts per year...");
      let eventCountIssues = 0;
      let yearsWithExtraEvents = 0;
      for (const stats of yearStats) {
        if (stats.total < 6) {
          eventCountIssues++;
          issues.push(`   Year ${stats.year}: Has only ${stats.total} events (minimum 6 required)`);
        } else if (stats.total > 6) {
          yearsWithExtraEvents++;
        }
      }
      if (eventCountIssues > 0) {
        console.log(`⚠️  ${eventCountIssues} years have insufficient events (< 6)`);
        totalIssues += eventCountIssues;
      } else {
        console.log("✅ All years have minimum required events");
      }
      if (yearsWithExtraEvents > 0) {
        console.log(`🎉 ${yearsWithExtraEvents} years have extra events for variety!`);
      }

      // Check 2: No duplicate events within a year
      console.log("\n✓ Checking for duplicate events...");
      let duplicateIssues = 0;
      for (const stats of yearStats) {
        // Get all events for this year
        const events = await client.query(api.events.getYearEvents, {
          year: stats.year,
        });
        const eventTexts = events.map((e: any) => e.event);
        const uniqueEventTexts = new Set(eventTexts);

        if (eventTexts.length !== uniqueEventTexts.size) {
          const duplicateCount = eventTexts.length - uniqueEventTexts.size;
          duplicateIssues++;
          issues.push(`   Year ${stats.year}: Has ${duplicateCount} duplicate event(s)`);

          // Find which events are duplicated
          const seen = new Set<string>();
          const duplicates = new Set<string>();
          for (const text of eventTexts) {
            if (seen.has(text)) {
              duplicates.add(text);
            }
            seen.add(text);
          }

          for (const dup of duplicates) {
            issues.push(`     - Duplicate: "${dup.substring(0, 50)}..."`);
          }
        }
      }
      if (duplicateIssues > 0) {
        console.log(`⚠️  ${duplicateIssues} years have duplicate events`);
        totalIssues += duplicateIssues;
      } else {
        console.log("✅ No duplicate events found");
      }

      // Check 3: All puzzleIds reference valid puzzles
      console.log("\n✓ Checking puzzle references...");
      let puzzleRefIssues = 0;
      const puzzleIdSet = new Set<string>();

      // Collect all unique puzzle IDs from events
      for (const stats of yearStats) {
        const events = await client.query(api.events.getYearEvents, {
          year: stats.year,
        });
        for (const event of events) {
          if (event.puzzleId) {
            puzzleIdSet.add(event.puzzleId);
          }
        }
      }

      // Verify each puzzle ID exists
      for (const puzzleId of puzzleIdSet) {
        try {
          const puzzle = await client.query(api.puzzles.getPuzzleById, {
            puzzleId: puzzleId as any,
          });
          if (!puzzle) {
            puzzleRefIssues++;
            issues.push(`   Invalid puzzle reference: ${puzzleId}`);
          }
        } catch {
          puzzleRefIssues++;
          issues.push(`   Invalid puzzle reference: ${puzzleId} (error querying)`);
        }
      }

      if (puzzleRefIssues > 0) {
        console.log(`⚠️  ${puzzleRefIssues} invalid puzzle references found`);
        totalIssues += puzzleRefIssues;
      } else {
        console.log("✅ All puzzle references are valid");
      }

      // Check 4: Years are within valid range (-2000 to 2025)
      console.log("\n✓ Checking year ranges...");
      let yearRangeIssues = 0;
      for (const stats of yearStats) {
        if (stats.year < -2000 || stats.year > 2025) {
          yearRangeIssues++;
          issues.push(`   Year ${stats.year}: Outside valid range (-2000 to 2025)`);
        }
      }
      if (yearRangeIssues > 0) {
        console.log(`⚠️  ${yearRangeIssues} years are outside valid range`);
        totalIssues += yearRangeIssues;
      } else {
        console.log("✅ All years are within valid range");
      }

      // Final report
      console.log("\n" + "=".repeat(50));
      if (totalIssues === 0) {
        console.log(`✅ ${yearStats.length} years validated, 0 issues found`);
      } else {
        console.log(`⚠️  ${yearStats.length} years validated, ${totalIssues} issues found:\n`);
        for (const issue of issues) {
          console.log(issue);
        }
      }

      // Exit with error code if issues found
      if (totalIssues > 0) {
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ Error validating events:`, error.message);
      process.exit(1);
    }
  });

// Check-years command: Bulk check if years exist
program
  .command("check-years <years...>")
  .description("Check which years exist in the database vs which are missing")
  .action(async (years) => {
    try {
      const client = await getConvexClient();

      console.log("🔍 Checking year existence...\n");

      const results = {
        existing: [] as number[],
        missing: [] as number[],
      };

      for (const yearStr of years) {
        const year = parseInt(yearStr);

        if (isNaN(year)) {
          console.log(`⚠️  Skipping invalid year: ${yearStr}`);
          continue;
        }

        try {
          const events = await client.query(api.events.getYearEvents, { year });

          if (events.length > 0) {
            results.existing.push(year);
            console.log(`✅ ${year}: EXISTS (${events.length} events)`);
          } else {
            results.missing.push(year);
            console.log(`❌ ${year}: MISSING`);
          }
        } catch {
          results.missing.push(year);
          console.log(`❌ ${year}: MISSING`);
        }
      }

      // Summary
      console.log("\n" + "=".repeat(50));
      console.log(`📊 Summary:`);
      console.log(`   Years checked: ${years.length}`);
      console.log(`   Existing: ${results.existing.length}`);
      console.log(`   Missing: ${results.missing.length}`);

      if (results.missing.length > 0) {
        console.log(`\n🆕 Missing years to add: ${results.missing.join(", ")}`);
      }

      if (results.existing.length > 0) {
        console.log(`\n✅ Existing years to review: ${results.existing.join(", ")}`);
      }
    } catch (error: any) {
      console.error("❌ Error checking years:", error.message);
      process.exit(1);
    }
  });

// Find-missing command: Find gaps in historical coverage
program
  .command("find-missing")
  .description("Find missing years in a range")
  .option("--from <year>", "Start year", parseInt)
  .option("--to <year>", "End year", parseInt)
  .action(async (options) => {
    try {
      const from = options.from || 1400;
      const to = options.to || 2000;
      const client = await getConvexClient();

      console.log(`🔍 Finding missing years from ${from} to ${to}...\n`);

      // Get all existing years
      const yearStats = await client.query(api.events.getAllYearsWithStats);
      const existingYears = new Set(yearStats.map((s: any) => s.year));

      const missingYears: number[] = [];

      for (let year = from; year <= to; year++) {
        if (!existingYears.has(year)) {
          missingYears.push(year);
        }
      }

      if (missingYears.length === 0) {
        console.log(`✅ All years from ${from} to ${to} have events!`);
      } else {
        console.log(`Found ${missingYears.length} missing years:\n`);

        // Group by decade for readability
        const decades: { [key: string]: number[] } = {};

        for (const year of missingYears) {
          const decade = Math.floor(year / 10) * 10;
          const decadeKey = `${decade}s`;
          if (!decades[decadeKey]) {
            decades[decadeKey] = [];
          }
          decades[decadeKey].push(year);
        }

        for (const [decade, years] of Object.entries(decades)) {
          console.log(`${decade}: ${years.join(", ")}`);
        }

        console.log(`\n📊 Total missing: ${missingYears.length} years`);
      }
    } catch (error: any) {
      console.error("❌ Error finding missing years:", error.message);
      process.exit(1);
    }
  });

// Audit command: Quality assessment
program
  .command("audit")
  .description("Audit database for quality issues and prioritize work")
  .action(async () => {
    try {
      const client = await getConvexClient();

      console.log("🔍 Auditing database quality...\n");

      const yearStats = await client.query(api.events.getAllYearsWithStats);

      // Categorize years
      const categories = {
        depleted: [] as any[], // Red: 0 available
        lowAvailability: [] as any[], // Yellow: 1-5 available
        unused: [] as any[], // Green with 0 used
        healthy: [] as any[], // Green with some usage
      };

      const qualityIssues: { year: number; issues: string[] }[] = [];

      for (const stats of yearStats) {
        // Categorize by availability
        if (stats.available === 0) {
          categories.depleted.push(stats);
        } else if (stats.available < 6) {
          categories.lowAvailability.push(stats);
        } else if (stats.used === 0) {
          categories.unused.push(stats);
        } else {
          categories.healthy.push(stats);
        }

        // Check for quality issues
        const events = await client.query(api.events.getYearEvents, {
          year: stats.year,
        });

        const yearIssues: string[] = [];

        for (const event of events) {
          // Check for missing proper nouns (no capital letters after first word)
          const words = event.event.split(" ");
          const hasProperNoun = words
            .slice(1)
            .some((word: any) => word.length > 0 && word[0] === word[0].toUpperCase());

          if (!hasProperNoun && !event.puzzleId) {
            yearIssues.push(`Possibly vague: "${event.event.substring(0, 50)}..."`);
          }
        }

        if (yearIssues.length > 0) {
          qualityIssues.push({ year: stats.year, issues: yearIssues });
        }
      }

      // Report findings
      console.log("📊 DATABASE STATUS\n");
      console.log("=".repeat(50));

      console.log("\n🔴 PRIORITY 1: Depleted Years (need more events)");
      if (categories.depleted.length > 0) {
        for (const year of categories.depleted) {
          console.log(`   ${year.year}: All ${year.total} events used`);
        }
      } else {
        console.log("   None - all years have available events!");
      }

      console.log("\n🟡 PRIORITY 2: Low Availability (< 6 available)");
      if (categories.lowAvailability.length > 0) {
        for (const year of categories.lowAvailability) {
          console.log(
            `   ${year.year}: Only ${year.available} available (${year.used}/${year.total} used)`,
          );
        }
      } else {
        console.log("   None - all years have sufficient availability!");
      }

      console.log("\n🟢 PRIORITY 3: Unused Years (quality review needed)");
      if (categories.unused.length > 0) {
        console.log(`   ${categories.unused.length} years with 0 puzzles created`);
        console.log(
          `   Years: ${categories.unused
            .map((y) => y.year)
            .slice(0, 10)
            .join(", ")}${categories.unused.length > 10 ? "..." : ""}`,
        );
      } else {
        console.log("   None - all years have been used!");
      }

      console.log("\n⚠️  QUALITY ISSUES (vague events without proper nouns)");
      if (qualityIssues.length > 0) {
        const topIssues = qualityIssues.slice(0, 5);
        for (const { year, issues } of topIssues) {
          console.log(`\n   Year ${year}:`);
          for (const issue of issues.slice(0, 2)) {
            console.log(`     - ${issue}`);
          }
        }
        if (qualityIssues.length > 5) {
          console.log(`\n   ... and ${qualityIssues.length - 5} more years with issues`);
        }
      } else {
        console.log("   None detected - all events appear to use proper nouns!");
      }

      // Summary
      console.log("\n" + "=".repeat(50));
      console.log("📈 SUMMARY");
      console.log(`   Total years: ${yearStats.length}`);
      console.log(`   Healthy years: ${categories.healthy.length}`);
      console.log(
        `   Needs attention: ${categories.depleted.length + categories.lowAvailability.length}`,
      );
      console.log(`   Quality review needed: ${qualityIssues.length}`);
    } catch (error: any) {
      console.error("❌ Error auditing database:", error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
