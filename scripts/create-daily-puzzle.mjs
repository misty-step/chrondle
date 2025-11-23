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
  console.error("Error loading .env.local:", error.message);
  process.exit(1);
}

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function createTodaysPuzzle() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`Creating puzzle for ${today}...`);

  try {
    const result = await client.mutation(api.puzzles.createDailyPuzzle, {
      date: today,
    });

    if (result.created) {
      console.log("✅ Puzzle created successfully!");
      console.log(`   Date: ${result.puzzle.date}`);
      console.log(`   Year: ${result.puzzle.year}`);
      console.log(`   Events: ${result.puzzle.events.length}`);
      console.log(`   First hint: "${result.puzzle.events[0]}"`);
    } else {
      console.log("ℹ️  Puzzle already exists for today");
      console.log(`   Date: ${result.puzzle.date}`);
      console.log(`   Year: ${result.puzzle.year}`);
    }
  } catch (error) {
    console.error("❌ Error creating puzzle:", error.message);
    process.exit(1);
  }
}

// Run the script
createTodaysPuzzle();
