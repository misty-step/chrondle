#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
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
  // In CI, environment variables should already be set
  if (error.code !== "ENOENT") {
    console.error("Error loading .env.local:", error.message);
    process.exit(1);
  }
  console.log("No .env.local file found, using environment variables");
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.log("NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
  console.log("Skipping Convex validation in CI environment");
  process.exit(0);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function checkState() {
  console.log("Checking Convex database state...\n");

  try {
    // Check for today's puzzle
    console.log("📅 Today's Puzzle:");
    const today = await client.query(api.puzzles.getDailyPuzzle);
    if (today) {
      console.log(`   Date: ${today.date}`);
      console.log(`   Year: ${today.targetYear}`);
      console.log(`   Events: ${today.events.length}`);
      console.log(`   Puzzle Number: ${today.puzzleNumber}`);
    } else {
      console.log("   No puzzle found for today");
    }

    // Check archive
    console.log("\n📚 Archive Status:");
    const archive = await client.query(api.puzzles.getArchivePuzzles, {
      page: 1,
      pageSize: 5,
    });
    console.log(`   Total puzzles in database: ${archive.totalCount}`);
    console.log(`   Total pages: ${archive.totalPages}`);
    console.log(`   Current page: ${archive.currentPage}`);

    if (archive.puzzles.length > 0) {
      console.log("   Recent puzzles:");
      archive.puzzles.forEach((puzzle) => {
        console.log(
          `     - Puzzle #${puzzle.puzzleNumber} (${puzzle.date}): Year ${puzzle.targetYear}`,
        );
      });
    }

    // Check year events pool (if available)
    console.log("\n🗂️  Year Events Pool:");
    try {
      const poolStats = await client.query(api.yearEvents.getPoolStats);
      console.log(`   Total years: ${poolStats.total}`);
      console.log(`   Used: ${poolStats.used}`);
      console.log(`   Available (6+ events): ${poolStats.available}`);
      console.log(`   Insufficient events: ${poolStats.insufficientEvents}`);
    } catch (error) {
      console.log("   ❌ Year events pool not available yet");
      console.log(
        "   Run 'node scripts/migrate-year-events.mjs' after Convex picks up the new functions",
      );
    }
  } catch (error) {
    console.error("Error checking state:", error.message);
    process.exit(1);
  }
}

// Run the check
checkState();
