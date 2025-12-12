/**
 * Test script for OpenRouter Responses API integration
 * Validates API endpoint, response parsing, and context quality
 *
 * Usage: pnpm tsx scripts/test-responses-api.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
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
    console.error("❌ Error loading .env.local:", error.message);
    process.exit(1);
  }
}

async function getConvexClient(): Promise<ConvexHttpClient> {
  await loadEnv();

  const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!CONVEX_URL) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
    process.exit(1);
  }

  return new ConvexHttpClient(CONVEX_URL);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

async function runTests(): Promise<void> {
  console.log("🧪 Testing OpenRouter Responses API Integration\n");

  const results: TestResult[] = [];
  const client = await getConvexClient();

  try {
    // Verify environment variables
    console.log("📋 Step 1: Verifying environment configuration...");
    const apiKey = process.env.OPENROUTER_API_KEY;
    const gpt5Enabled = process.env.OPENAI_GPT5_ENABLED !== "false";

    if (!apiKey) {
      results.push({
        name: "Environment Configuration",
        passed: false,
        message: "OPENROUTER_API_KEY not found in environment",
      });
      console.error("❌ OPENROUTER_API_KEY not configured");
      printResults(results);
      return;
    }

    results.push({
      name: "Environment Configuration",
      passed: true,
      message: `API key configured, GPT-5 ${gpt5Enabled ? "enabled" : "disabled"}`,
    });
    console.log(`✅ API key configured, GPT-5 ${gpt5Enabled ? "enabled" : "disabled"}\n`);

    // Test 1: Generate puzzle with historical context
    console.log("📋 Step 2: Generating test puzzle with historical context...");
    const _testDate = `2025-99-${Math.floor(Math.random() * 89) + 10}`; // Unique test date (unused currently)

    let puzzle: any;
    try {
      // Generate a puzzle for today (will trigger context generation)
      puzzle = await client.query(api.puzzles.getDailyPuzzle);

      if (!puzzle) {
        console.log("No puzzle exists for today, creating one...");
        // Note: We can't directly call internal mutations from the client
        // This would need to be done via the Convex dashboard or a separate admin action
        results.push({
          name: "Puzzle Generation",
          passed: false,
          message: "No daily puzzle found. Run 'pnpm events' to generate one first.",
        });
        printResults(results);
        return;
      }

      results.push({
        name: "Puzzle Retrieval",
        passed: true,
        message: `Retrieved puzzle #${puzzle.puzzleNumber} for year ${puzzle.targetYear}`,
        details: {
          puzzleNumber: puzzle.puzzleNumber,
          targetYear: puzzle.targetYear,
          eventCount: puzzle.events.length,
        },
      });
      console.log(`✅ Retrieved puzzle #${puzzle.puzzleNumber} for year ${puzzle.targetYear}\n`);
    } catch (error: any) {
      results.push({
        name: "Puzzle Retrieval",
        passed: false,
        message: `Failed to retrieve puzzle: ${error.message}`,
      });
      console.error(`❌ Failed to retrieve puzzle: ${error.message}\n`);
      printResults(results);
      return;
    }

    // Test 2: Verify historical context exists
    console.log("📋 Step 3: Validating historical context...");
    const context = puzzle.historicalContext;

    if (!context) {
      results.push({
        name: "Historical Context Existence",
        passed: false,
        message: "No historical context found (may still be generating)",
      });
      console.log(
        "⚠️  No historical context found. It may still be generating. Check again in a few seconds.\n",
      );
    } else {
      results.push({
        name: "Historical Context Existence",
        passed: true,
        message: `Context generated (${context.length} characters)`,
      });
      console.log(`✅ Context generated (${context.length} characters)\n`);

      // Test 3: Validate context length (350-450 words target, 300-600 acceptable with high verbosity)
      console.log("📋 Step 4: Checking context length...");
      const wordCount = context.split(/\s+/).filter((w: string) => w.length > 0).length;
      const lengthOk = wordCount >= 300 && wordCount <= 600; // High verbosity produces more content

      results.push({
        name: "Context Length",
        passed: lengthOk,
        message: `${wordCount} words (target: 350-450, acceptable: 300-600)`,
        details: { wordCount, characterCount: context.length },
      });

      if (lengthOk) {
        console.log(`✅ Context length appropriate: ${wordCount} words\n`);
      } else {
        console.log(
          `⚠️  Context length outside acceptable range: ${wordCount} words (acceptable: 300-600)\n`,
        );
      }

      // Test 4: Verify BC/AD format enforcement (no BCE/CE)
      console.log("📋 Step 5: Validating BC/AD format enforcement...");
      const hasBCE = /\bBCE\b/i.test(context);
      const hasCE = /\bCE\b/i.test(context);
      const bcadEnforced = !hasBCE && !hasCE;

      results.push({
        name: "BC/AD Format Enforcement",
        passed: bcadEnforced,
        message: bcadEnforced
          ? "No BCE/CE found (BC/AD enforced)"
          : `Found ${hasBCE ? "BCE" : ""}${hasBCE && hasCE ? " and " : ""}${hasCE ? "CE" : ""}`,
      });

      if (bcadEnforced) {
        console.log("✅ BC/AD format enforced (no BCE/CE found)\n");
      } else {
        console.log("❌ BC/AD enforcement failed: found BCE or CE in context\n");
      }

      // Test 5: Verify event integration
      console.log("📋 Step 6: Checking event integration...");
      const events = puzzle.events as string[];
      const eventMentions = events.filter((event: string) => {
        // Extract key terms from event (ignore common words)
        const terms = event
          .toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 4);
        // Check if any significant term appears in context
        return terms.some((term: string) => context.toLowerCase().includes(term));
      });

      const integrationRatio = eventMentions.length / events.length;
      const integrationOk = integrationRatio >= 0.5; // At least 50% of events mentioned

      results.push({
        name: "Event Integration",
        passed: integrationOk,
        message: `${eventMentions.length}/${events.length} events referenced (${Math.round(integrationRatio * 100)}%)`,
        details: {
          totalEvents: events.length,
          mentioned: eventMentions.length,
          ratio: integrationRatio,
        },
      });

      if (integrationOk) {
        console.log(
          `✅ Events well integrated: ${eventMentions.length}/${events.length} referenced\n`,
        );
      } else {
        console.log(
          `⚠️  Low event integration: ${eventMentions.length}/${events.length} referenced\n`,
        );
      }

      // Test 6: Display sample context
      console.log("📋 Step 7: Sample context preview...");
      console.log("\n--- Historical Context Sample (first 500 chars) ---");
      console.log(context.substring(0, 500) + "...\n");
      console.log("--- End Sample ---\n");
    }
  } catch (error: any) {
    console.error("\n❌ Test execution failed:", error.message);
    console.error(error.stack);
  }

  // Print final results
  printResults(results);
}

function printResults(results: TestResult[]): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST RESULTS");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result, index) => {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${index + 1}. ${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log();
  });

  console.log("=".repeat(60));
  console.log(`SUMMARY: ${passed}/${total} tests passed`);
  console.log("=".repeat(60) + "\n");

  if (passed === total) {
    console.log("🎉 All tests passed! Responses API integration is working correctly.\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Review the results above.\n");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
