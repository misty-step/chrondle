#!/usr/bin/env tsx
/**
 * Run promptfoo evals with OpenRouter.
 *
 * Uses the native openrouter: provider which reads OPENROUTER_API_KEY directly.
 */

import * as dotenv from "dotenv";
import { execSync } from "child_process";

// Load .env.local
dotenv.config({ path: ".env.local" });

if (!process.env.OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY in .env.local");
  process.exit(1);
}

console.log("Running promptfoo evals with OpenRouter (Gemini 3 Pro)...");

// Native openrouter: provider reads OPENROUTER_API_KEY directly
execSync("npx promptfoo eval -c evals/promptfoo.yaml", {
  stdio: "inherit",
  env: process.env,
});
