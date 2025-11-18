#!/usr/bin/env tsx

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Command } from "commander";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";

const program = new Command();

async function loadEnv(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = join(__dirname, "../.env.local");
  const envContent = await fs.readFile(envPath, "utf-8");
  Object.assign(process.env, dotenv.parse(envContent));
}

async function getClient(): Promise<ConvexHttpClient> {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

program
  .name("test-event-generation")
  .description("Manual testing tool for the event generation pipeline")
  .option("-y, --year <year>", "Target year (defaults to random missing year)")
  .option("--count <count>", "Number of years to generate", "1")
  .option("--dry-run", "Do not persist events to the database")
  .option("--verbose", "Print detailed LLM usage and prompts");

program.action(async (options) => {
  const client = await getClient();
  const count = Number(options.count) || 1;
  const years = [] as number[];

  if (options.year) {
    years.push(Number(options.year));
  } else {
    const selector = await client.action(api.lib.workSelector.testSelectWorkYears, {
      count,
    });
    years.push(...selector.years);
  }

  console.log(`🔍 Testing pipeline for years: ${years.join(", ")}`);

  for (const year of years) {
    console.log(`\n=== Year ${year} ===`);
    const result = await client.action(
      api.actions.eventGeneration.orchestrator.testGenerateYearEvents,
      {
        year,
      },
    );

    if (result.status === "success") {
      console.log(
        `✅ ${result.events.length} events generated (attempts: ${result.metadata.attempts})`,
      );
      result.events.forEach((event: any, index: number) => {
        console.log(`  ${index + 1}. ${event.event_text} [${event.domain}]`);
      });

      if (options.verbose) {
        console.log("LLM Usage:", JSON.stringify(result.usage, null, 2));
      }
    } else {
      console.log("❌ Generation failed:", result.reason);
    }

    if (options.dryRun) {
      console.log("(dry-run) Skipping persistence for this year");
    }
  }

  process.exit(0);
});

program.parseAsync();
