#!/usr/bin/env node

import { Command } from "commander";
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
    console.error("Error loading .env.local:", error.message);
    process.exit(1);
  }
}

// Initialize Convex client
async function getConvexClient(): Promise<ConvexHttpClient> {
  await loadEnv();

  const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!CONVEX_URL) {
    console.error("NEXT_PUBLIC_CONVEX_URL is not set in environment variables");
    process.exit(1);
  }

  return new ConvexHttpClient(CONVEX_URL);
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Exact match
  if (s1 === s2) return 1;

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

// Check if event has proper nouns
function hasProperNouns(event: string): boolean {
  const words = event.split(" ");

  // Skip first word (often capitalized regardless)
  const remainingWords = words.slice(1);

  // Check for capital letters (proper nouns)
  const hasCapitals = remainingWords.some(
    (word) =>
      word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase(),
  );

  // Check for known proper noun indicators
  const properNounIndicators = [
    "Empire",
    "Dynasty",
    "King",
    "Queen",
    "Emperor",
    "President",
    "War",
    "Battle",
    "Treaty",
    "Act",
    "Revolution",
    "Republic",
    "Church",
    "Cathedral",
    "University",
    "Company",
    "Corporation",
  ];

  const hasIndicators = words.some((word) =>
    properNounIndicators.some((indicator) => word.includes(indicator)),
  );

  return hasCapitals || hasIndicators;
}

// Detect potentially problematic phrasing
function detectProblematicPhrasing(event: string): string[] {
  const issues: string[] = [];

  const vagueTerms = [
    "scientist",
    "explorer",
    "leader",
    "ruler",
    "inventor",
    "philosopher",
    "artist",
    "writer",
    "composer",
    "architect",
    "general",
    "admiral",
    "politician",
    "reformer",
    "revolutionary",
  ];

  const lowerEvent = event.toLowerCase();

  for (const term of vagueTerms) {
    if (lowerEvent.includes(term) && !hasProperNouns(event)) {
      issues.push(`Uses generic term "${term}" without proper noun`);
    }
  }

  // Check for year-revealing phrases
  const yearPatterns = [
    /\d{4}/, // Any 4-digit number
    /\d{2}th century/, // "19th century"
    /Y2K/i, // Y2K reference
    /millennium/i, // Millennium reference
  ];

  for (const pattern of yearPatterns) {
    if (pattern.test(event)) {
      issues.push("May reveal year in hint text");
    }
  }

  // Check for overly vague language
  const vagueStarts = [
    "A major",
    "An important",
    "A significant",
    "A notable",
    "A famous",
    "A renowned",
    "A celebrated",
    "A prominent",
  ];

  for (const start of vagueStarts) {
    if (event.startsWith(start)) {
      issues.push(`Starts with vague qualifier: "${start}"`);
    }
  }

  return issues;
}

// Create the CLI program
const program = new Command();

program
  .name("audit-events")
  .description("Advanced quality auditing for Chrondle event database")
  .version("1.0.0");

// Deep quality check command
program
  .command("quality")
  .description("Deep quality analysis of all events")
  .option("--fix-suggestions", "Show suggested fixes for issues")
  .action(async (options) => {
    try {
      const client = await getConvexClient();

      console.log("🔍 Running deep quality analysis...\n");

      const yearStats = await client.query(api.events.getAllYearsWithStats);

      let totalEvents = 0;
      let eventsWithIssues = 0;
      const issuesByType: { [key: string]: number } = {};
      const examplesByType: { [key: string]: any[] } = {};

      for (const stats of yearStats) {
        const events = await client.query(api.events.getYearEvents, {
          year: stats.year,
        });

        for (const event of events) {
          totalEvents++;

          const issues: string[] = [];

          // Check for proper nouns
          if (!hasProperNouns(event.event)) {
            issues.push("Missing proper nouns");
          }

          // Check for problematic phrasing
          const phrasingIssues = detectProblematicPhrasing(event.event);
          issues.push(...phrasingIssues);

          // Check event length
          const wordCount = event.event.split(" ").length;
          if (wordCount > 20) {
            issues.push(`Too long (${wordCount} words, max 20)`);
          }

          if (issues.length > 0 && !event.classicPuzzleId) {
            eventsWithIssues++;

            for (const issue of issues) {
              issuesByType[issue] = (issuesByType[issue] || 0) + 1;

              if (!examplesByType[issue]) {
                examplesByType[issue] = [];
              }

              if (examplesByType[issue].length < 3) {
                examplesByType[issue].push({
                  year: stats.year,
                  event: event.event,
                  eventId: event._id,
                });
              }
            }
          }
        }
      }

      // Report findings
      console.log("📊 QUALITY ANALYSIS REPORT\n");
      console.log("=".repeat(50));
      console.log(`\nTotal events analyzed: ${totalEvents}`);
      console.log(
        `Events with issues: ${eventsWithIssues} (${Math.round((eventsWithIssues / totalEvents) * 100)}%)`,
      );

      console.log("\n🔴 Issues by Type:\n");

      const sortedIssues = Object.entries(issuesByType).sort((a, b) => b[1] - a[1]);

      for (const [issue, count] of sortedIssues) {
        console.log(`${issue}: ${count} events`);

        if (options.fixSuggestions && examplesByType[issue]) {
          console.log("  Examples:");
          for (const example of examplesByType[issue].slice(0, 2)) {
            console.log(`    Year ${example.year}: "${example.event.substring(0, 60)}..."`);

            // Suggest fixes
            if (issue === "Missing proper nouns") {
              console.log(`      💡 Add specific names, places, or organizations`);
            } else if (issue.includes("generic term")) {
              const term = issue.match(/"([^"]+)"/)?.[1];
              console.log(`      💡 Replace "${term}" with the actual person's name`);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("❌ Error running quality analysis:", error.message);
      process.exit(1);
    }
  });

// Find duplicate events across years
program
  .command("duplicates")
  .description("Find similar or duplicate events across different years")
  .option("--threshold <number>", "Similarity threshold (0-1)", parseFloat, 0.85)
  .action(async (options) => {
    try {
      const client = await getConvexClient();
      const threshold = options.threshold;

      console.log(`🔍 Finding duplicate events (similarity > ${threshold})...\n`);

      const yearStats = await client.query(api.events.getAllYearsWithStats);
      const allEvents: { year: number; event: string; id: string }[] = [];

      // Collect all events
      for (const stats of yearStats) {
        const events = await client.query(api.events.getYearEvents, {
          year: stats.year,
        });

        for (const event of events) {
          allEvents.push({
            year: stats.year,
            event: event.event,
            id: event._id,
          });
        }
      }

      // Find duplicates
      const duplicates: any[] = [];

      for (let i = 0; i < allEvents.length; i++) {
        for (let j = i + 1; j < allEvents.length; j++) {
          const similarity = calculateSimilarity(allEvents[i].event, allEvents[j].event);

          if (similarity >= threshold) {
            duplicates.push({
              event1: allEvents[i],
              event2: allEvents[j],
              similarity: Math.round(similarity * 100),
            });
          }
        }
      }

      if (duplicates.length === 0) {
        console.log(`✅ No duplicate events found with similarity > ${threshold}`);
      } else {
        console.log(`Found ${duplicates.length} potential duplicates:\n`);

        // Sort by similarity
        duplicates.sort((a, b) => b.similarity - a.similarity);

        for (const dup of duplicates.slice(0, 20)) {
          console.log(`${dup.similarity}% similar:`);
          console.log(`  Year ${dup.event1.year}: "${dup.event1.event}"`);
          console.log(`  Year ${dup.event2.year}: "${dup.event2.event}"`);
          console.log("");
        }

        if (duplicates.length > 20) {
          console.log(`... and ${duplicates.length - 20} more potential duplicates`);
        }
      }
    } catch (error: any) {
      console.error("❌ Error finding duplicates:", error.message);
      process.exit(1);
    }
  });

// Suggest improvements for a specific year
program
  .command("improve <year>")
  .description("Get specific improvement suggestions for a year")
  .action(async (yearStr) => {
    const year = parseInt(yearStr);

    if (isNaN(year)) {
      console.error("❌ Error: Invalid year");
      process.exit(1);
    }

    try {
      const client = await getConvexClient();

      console.log(`🔍 Analyzing year ${year} for improvements...\n`);

      const events = await client.query(api.events.getYearEvents, { year });

      if (events.length === 0) {
        console.log(`Year ${year} not found in database.`);
        return;
      }

      console.log(`📅 Year ${year} has ${events.length} events:\n`);

      let hasIssues = false;

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const issues: string[] = [];

        // Check various quality metrics
        if (!hasProperNouns(event.event)) {
          issues.push("Add proper nouns");
        }

        const phrasingIssues = detectProblematicPhrasing(event.event);
        issues.push(...phrasingIssues);

        const wordCount = event.event.split(" ").length;
        if (wordCount > 20) {
          issues.push(`Shorten to ≤20 words (currently ${wordCount})`);
        }

        if (issues.length > 0 && !event.classicPuzzleId) {
          hasIssues = true;
          console.log(`${i + 1}. "${event.event}"`);
          console.log(`   ⚠️  Issues:`);
          for (const issue of issues) {
            console.log(`      - ${issue}`);
          }
          console.log(`   💡 To fix: pnpm events update-one -y ${year} -n ${i + 1} -t "..."`);
          console.log("");
        }
      }

      if (!hasIssues) {
        console.log("✅ All events look good! No quality issues detected.");
      }

      // Additional suggestions
      console.log("\n📊 Summary:");
      console.log(`   Total events: ${events.length}`);

      if (events.length < 10) {
        console.log(`   💡 Consider adding ${10 - events.length} more events for variety`);
      }

      // Check event diversity
      const categories = {
        politics: ["president", "king", "queen", "parliament", "election", "treaty"],
        science: ["discovers", "invents", "patent", "laboratory", "experiment"],
        culture: ["publishes", "performs", "exhibition", "museum", "festival"],
        war: ["battle", "war", "siege", "invasion", "surrender", "victory"],
        religion: ["pope", "church", "cathedral", "reformation", "crusade"],
      };

      const foundCategories = new Set<string>();

      for (const event of events) {
        const lower = event.event.toLowerCase();
        for (const [category, keywords] of Object.entries(categories)) {
          if (keywords.some((kw) => lower.includes(kw))) {
            foundCategories.add(category);
          }
        }
      }

      if (foundCategories.size < 3) {
        console.log(
          `   💡 Add more diverse events (currently heavy on ${Array.from(foundCategories).join(", ") || "general topics"})`,
        );
      }
    } catch (error: any) {
      console.error("❌ Error analyzing year:", error.message);
      process.exit(1);
    }
  });

// Priority report
program
  .command("priority")
  .description("Generate prioritized work list")
  .option("--limit <number>", "Limit results per category", parseInt, 10)
  .action(async (options) => {
    try {
      const client = await getConvexClient();
      const limit = options.limit;

      console.log("🎯 Generating Priority Work List...\n");

      const yearStats = await client.query(api.events.getAllYearsWithStats);

      // Categorize and score years
      const priorities = {
        critical: [] as any[], // < 6 events total
        high: [] as any[], // 0 available
        medium: [] as any[], // < 6 available
        low: [] as any[], // Quality issues
      };

      for (const stats of yearStats) {
        if (stats.total < 6) {
          priorities.critical.push({
            year: stats.year,
            reason: `Only ${stats.total} events (need 6 minimum)`,
            action: `Add ${6 - stats.total} more events`,
          });
        } else if (stats.available === 0) {
          priorities.high.push({
            year: stats.year,
            reason: `All ${stats.total} events used`,
            action: `Add 4-6 more events for variety`,
          });
        } else if (stats.available < 6) {
          priorities.medium.push({
            year: stats.year,
            reason: `Only ${stats.available} available`,
            action: `Add 2-4 more events`,
          });
        } else if (stats.used === 0) {
          // Check for quality issues
          const events = await client.query(api.events.getYearEvents, {
            year: stats.year,
          });

          let qualityScore = 0;
          for (const event of events) {
            if (hasProperNouns(event.event)) qualityScore++;
          }

          if (qualityScore < events.length * 0.8) {
            priorities.low.push({
              year: stats.year,
              reason: "Unused year with quality issues",
              action: "Review and improve event quality",
            });
          }
        }
      }

      // Report priorities
      console.log("🔴 CRITICAL PRIORITY (Insufficient events for puzzles)");
      if (priorities.critical.length > 0) {
        for (const item of priorities.critical.slice(0, limit)) {
          console.log(`   Year ${item.year}: ${item.reason}`);
          console.log(`   → ${item.action}`);
        }
        if (priorities.critical.length > limit) {
          console.log(`   ... and ${priorities.critical.length - limit} more`);
        }
      } else {
        console.log("   None - all years have minimum events!");
      }

      console.log("\n🟠 HIGH PRIORITY (Fully depleted)");
      if (priorities.high.length > 0) {
        for (const item of priorities.high.slice(0, limit)) {
          console.log(`   Year ${item.year}: ${item.reason}`);
          console.log(`   → ${item.action}`);
        }
        if (priorities.high.length > limit) {
          console.log(`   ... and ${priorities.high.length - limit} more`);
        }
      } else {
        console.log("   None!");
      }

      console.log("\n🟡 MEDIUM PRIORITY (Low availability)");
      if (priorities.medium.length > 0) {
        for (const item of priorities.medium.slice(0, limit)) {
          console.log(`   Year ${item.year}: ${item.reason}`);
          console.log(`   → ${item.action}`);
        }
        if (priorities.medium.length > limit) {
          console.log(`   ... and ${priorities.medium.length - limit} more`);
        }
      } else {
        console.log("   None!");
      }

      console.log("\n🟢 LOW PRIORITY (Quality improvements)");
      if (priorities.low.length > 0) {
        for (const item of priorities.low.slice(0, limit)) {
          console.log(`   Year ${item.year}: ${item.reason}`);
          console.log(`   → ${item.action}`);
        }
        if (priorities.low.length > limit) {
          console.log(`   ... and ${priorities.low.length - limit} more`);
        }
      } else {
        console.log("   None!");
      }

      // Summary
      console.log("\n" + "=".repeat(50));
      console.log("📈 SUMMARY");
      console.log(`   Critical issues: ${priorities.critical.length}`);
      console.log(`   High priority: ${priorities.high.length}`);
      console.log(`   Medium priority: ${priorities.medium.length}`);
      console.log(`   Low priority: ${priorities.low.length}`);
      console.log(`   Total years: ${yearStats.length}`);
    } catch (error: any) {
      console.error("❌ Error generating priority list:", error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
