#!/usr/bin/env node
console.log("Schema Validation Error - Action Required!");
console.log("==========================================\n");

console.log("The Convex schema has been updated to include a 'createdAt' field in dailyPuzzles,");
console.log("but existing records don't have this field.\n");

console.log("To fix this, you have two options:\n");

console.log("Option 1: Clean Slate (Recommended)");
console.log("------------------------------------");
console.log("1. Go to https://dashboard.convex.dev");
console.log("2. Navigate to your project");
console.log("3. Go to the Data tab");
console.log("4. Select the 'dailyPuzzles' table");
console.log("5. Delete ALL records (they were created with the wrong approach anyway)");
console.log("6. After deletion, restart 'npx convex dev'");
console.log("7. Run 'node scripts/migrate-year-events.mjs' to import the year pool");
console.log("8. Run 'node scripts/create-daily-puzzle.mjs' to create today's puzzle\n");

console.log("Option 2: Make createdAt Optional");
console.log("----------------------------------");
console.log("Edit convex/schema.ts and change:");
console.log("  createdAt: v.number()");
console.log("to:");
console.log("  createdAt: v.optional(v.number())\n");

console.log("Since we're redesigning the puzzle system anyway, Option 1 is recommended.");
console.log("\nPress Ctrl+C to exit...");
