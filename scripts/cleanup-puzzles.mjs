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

console.log("This script will help clean up the incorrectly migrated puzzle data.");
console.log("Since we cannot directly delete from a query, you'll need to:");
console.log("1. Go to the Convex dashboard at https://dashboard.convex.dev");
console.log("2. Navigate to your project");
console.log("3. Go to the Data tab");
console.log("4. Select the 'dailyPuzzles' table");
console.log("5. Delete all records (they were created with the wrong approach)");
console.log("\nAfter cleaning up, run: node scripts/migrate-year-events.mjs");
console.log("\nPress Enter to open the Convex dashboard...");

process.stdin.once("data", () => {
  console.log("Opening Convex dashboard...");
  import("open")
    .then((open) => {
      open.default("https://dashboard.convex.dev");
    })
    .catch(() => {
      console.log("Please open https://dashboard.convex.dev manually");
    });
  process.exit(0);
});
