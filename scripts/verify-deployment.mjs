#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

// Load environment variables (from env vars first, then .env.local fallback)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, "../.env.local");

// Only load .env.local if NEXT_PUBLIC_CONVEX_URL is not already set (CI passes it directly)
if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  try {
    const envContent = await fs.readFile(envPath, "utf-8");
    const envVars = dotenv.parse(envContent);
    Object.assign(process.env, envVars);
  } catch (error) {
    console.error("❌ Error loading .env.local:", error.message);
    console.error("   Set NEXT_PUBLIC_CONVEX_URL environment variable or create .env.local");
    process.exit(1);
  }
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
  process.exit(1);
}

console.log("🚀 Verifying Chrondle deployment...\n");

const client = new ConvexHttpClient(CONVEX_URL);

// Track overall verification status
let hasErrors = false;

async function verifyDeployment() {
  // Check 1: Convex connection
  console.log("1️⃣  Checking Convex connection...");
  try {
    // Try a simple query to verify connection
    await client.query(api.puzzles.getArchivePuzzles, {
      page: 1,
      pageSize: 1
    });
    console.log("   ✅ Convex connection successful");
  } catch (error) {
    console.error("   ❌ Failed to connect to Convex:", error.message);
    hasErrors = true;
    // If we can't connect, no point continuing
    process.exit(1);
  }

  // Check 2: Event table has data
  console.log("\n2️⃣  Checking event data...");
  try {
    const eventStats = await client.query(api.events.getEventPoolStats);
    
    if (eventStats.totalEvents === 0) {
      console.error("   ❌ No events found in database!");
      console.error("   Run 'pnpm migrate-events' to populate events");
      hasErrors = true;
    } else {
      console.log(`   ✅ Event table contains ${eventStats.totalEvents} events`);
      console.log(`      - ${eventStats.assignedEvents} assigned to puzzles`);
      console.log(`      - ${eventStats.unassignedEvents} available for new puzzles`);
      console.log(`      - ${eventStats.uniqueYears} unique years`);
      console.log(`      - ${eventStats.availableYearsForPuzzles} years ready for puzzle generation`);
      
      if (eventStats.availableYearsForPuzzles === 0) {
        console.warn("   ⚠️  Warning: No years have enough events for new puzzles!");
        hasErrors = true;
      }
    }
  } catch (error) {
    console.error("   ❌ Failed to query event statistics:", error.message);
    hasErrors = true;
  }

  // Check 3: Cron job is scheduled (inferred by checking recent puzzles)
  console.log("\n3️⃣  Checking cron job activity...");
  try {
    const recentPuzzles = await client.query(api.puzzles.getArchivePuzzles, {
      page: 1,
      pageSize: 7 // Last week
    });
    
    if (recentPuzzles.puzzles.length === 0) {
      console.error("   ❌ No puzzles found in database!");
      console.error("   Cron job may not be running");
      hasErrors = true;
    } else {
      // Check if puzzles are being generated daily
      const puzzleDates = recentPuzzles.puzzles.map(p => p.date);
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      
      console.log(`   ✅ Found ${recentPuzzles.puzzles.length} recent puzzles`);
      console.log(`      Latest puzzle: ${puzzleDates[0]}`);
      
      // Check if today's or yesterday's puzzle exists (allowing for timezone differences)
      if (!puzzleDates.includes(today) && !puzzleDates.includes(yesterday)) {
        console.warn("   ⚠️  Warning: No puzzle for today or yesterday found");
        console.warn("   Cron job might not be running properly");
        hasErrors = true;
      } else {
        console.log("   ✅ Daily puzzle generation appears to be working");
      }
      
      // Check for gaps in recent puzzles
      const sortedDates = puzzleDates.sort().reverse();
      let gaps = 0;
      for (let i = 1; i < sortedDates.length; i++) {
        const date1 = new Date(sortedDates[i-1]);
        const date2 = new Date(sortedDates[i]);
        const dayDiff = Math.floor((date1 - date2) / 86400000);
        if (dayDiff > 1) {
          gaps++;
        }
      }
      
      if (gaps > 0) {
        console.warn(`   ⚠️  Warning: Found ${gaps} gap(s) in recent puzzle dates`);
      }
    }
  } catch (error) {
    console.error("   ❌ Failed to check puzzle history:", error.message);
    hasErrors = true;
  }

  // Check 4: Today's puzzle exists or can be generated
  console.log("\n4️⃣  Checking today's puzzle...");
  try {
    const todaysPuzzle = await client.query(api.puzzles.getDailyPuzzle);
    
    if (todaysPuzzle) {
      console.log("   ✅ Today's puzzle is available");
      console.log(`      - Date: ${todaysPuzzle.date}`);
      console.log(`      - Target Year: ${todaysPuzzle.targetYear}`);
      console.log(`      - Events: ${todaysPuzzle.events.length}`);
      console.log(`      - Play count: ${todaysPuzzle.playCount}`);
      
      // Verify puzzle integrity
      if (todaysPuzzle.events.length !== 6) {
        console.error(`   ❌ Today's puzzle has ${todaysPuzzle.events.length} events (expected 6)!`);
        hasErrors = true;
      }
    } else {
      console.error("   ❌ No puzzle found for today!");
      console.error("   The cron job should generate it at midnight UTC");
      hasErrors = true;
    }
  } catch (error) {
    console.error("   ❌ Failed to fetch today's puzzle:", error.message);
    hasErrors = true;
  }

  // Final summary
  console.log("\n" + "=".repeat(50));
  if (hasErrors) {
    console.error("❌ Deployment verification FAILED");
    console.error("   Please address the issues above before proceeding");
    process.exit(1);
  } else {
    console.log("✅ Deployment verification PASSED");
    console.log("   All systems operational!");
    process.exit(0);
  }
}

// Run verification
verifyDeployment().catch(error => {
  console.error("❌ Unexpected error during verification:", error);
  process.exit(1);
});