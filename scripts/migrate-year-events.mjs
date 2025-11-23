#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";
const puzzleData = JSON.parse(
  readFileSync(new URL("../src/data/puzzles.json", import.meta.url), "utf-8"),
);
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env.local");

try {
  const envContent = await fs.readFile(envPath, "utf-8");
  const envVars = dotenv.parse(envContent);
  Object.assign(process.env, envVars);
} catch (error) {
  console.error("Error loading .env.local:", error.message);
  process.exit(1);
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function migrateYearEvents() {
  console.log("Starting year events migration to Convex...");
  console.log(`Found ${Object.keys(puzzleData.puzzles).length} years to import`);

  let successCount = 0;
  let errorCount = 0;

  for (const [yearStr, events] of Object.entries(puzzleData.puzzles)) {
    const year = parseInt(yearStr);

    try {
      // Import all events for this year
      console.log(`Importing year ${year} with ${events.length} events...`);

      await client.mutation(api.yearEvents.importYearEvents, {
        year,
        events, // Import all events, not just the first 6
      });

      successCount++;

      // Rate limiting to avoid overwhelming the database
      if (successCount % 10 === 0) {
        console.log(`Progress: ${successCount} years imported`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error importing year ${year}:`, error);
      errorCount++;
    }
  }

  console.log("\nMigration completed!");
  console.log(`Successfully imported: ${successCount} years`);
  console.log(`Errors: ${errorCount}`);

  // Get pool statistics
  try {
    const stats = await client.query(api.yearEvents.getPoolStats);
    console.log("\nPool Statistics:");
    console.log(`Total years: ${stats.total}`);
    console.log(`Available for puzzles (6+ events): ${stats.available}`);
    console.log(`Insufficient events (<6): ${stats.insufficientEvents}`);
    console.log(`Already used: ${stats.used}`);
  } catch (error) {
    console.error("Error getting pool stats:", error);
  }
}

// Run the migration
migrateYearEvents().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
