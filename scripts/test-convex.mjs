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

async function test() {
  console.log("Testing Convex queries...\n");

  // Test today's puzzle
  const today = await client.query(api.puzzles.getTodaysPuzzle);
  console.log("Today's puzzle:", today);

  // Test archive query
  const archive = await client.query(api.puzzles.getArchivePuzzles, {
    paginationOpts: { numItems: 5 },
  });
  console.log("\nArchive preview:");
  archive.page.forEach((puzzle) => {
    console.log(`  ${puzzle.date}: Year ${puzzle.year} - ${puzzle.events.length} events`);
  });
  console.log(`Total in page: ${archive.page.length}`);
  console.log(`Has more: ${!archive.isDone}`);

  // Test specific date
  const specificDate = "2024-01-01";
  const specific = await client.query(api.puzzles.getPuzzleByDate, { date: specificDate });
  console.log(`\nPuzzle for ${specificDate}:`, specific ? `Year ${specific.year}` : "Not found");
}

test().catch(console.error);
