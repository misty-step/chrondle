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

console.log("Connecting to Convex at:", CONVEX_URL);

const client = new ConvexHttpClient(CONVEX_URL);

async function testConnection() {
  try {
    console.log("\nTesting getTodaysPuzzle query...");
    const puzzle = await client.query(api.puzzles.getTodaysPuzzle);

    if (puzzle) {
      console.log("✅ Successfully fetched today's puzzle!");
      console.log("   Date:", puzzle.date);
      console.log("   Year:", puzzle.year);
      console.log("   Events:", puzzle.events.length);
      console.log("   First hint:", puzzle.events[0]);
    } else {
      console.log("❌ No puzzle found for today");
    }
  } catch (error) {
    console.error("❌ Error fetching puzzle:", error.message);
    console.error("   Full error:", error);
  }
}

testConnection();
