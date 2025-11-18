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

const program = new Command();
program
  .name("test-event-generation-bulk")
  .description("Generate events for multiple years in parallel and summarize results")
  .option("--years <list>", "Comma-separated list of years (e.g. 1969,1914,-44)")
  .option("--count <count>", "Number of years to select via selector", "3")
  .option("--dry-run", "Skip persistence when calling orchestrator", false)
  .option("--verbose", "Print full event lists for each year", false);

program.action(async (options) => {
  const client = await getClient();
  let years: number[] = [];

  if (options.years) {
    years = options.years.split(",").map((year: string) => Number(year.trim()));
  } else {
    const count = Number(options.count) || 3;
    const selector = await client.action(api.lib.workSelector.testSelectWorkYears, {
      count,
    });
    years = selector.years;
  }

  console.log(`Running pipeline for years: ${years.join(", ")}`);

  const summaries = await Promise.all(
    years.map(async (year) => {
      const result = await client.action(
        api.actions.eventGeneration.orchestrator.testGenerateYearEvents,
        {
          year,
        },
      );

      if (options.verbose && result.status === "success") {
        console.log(`\nYear ${year}`);
        result.events.forEach((event: any, index: number) => {
          console.log(`  ${index + 1}. ${event.event_text}`);
        });
      }

      return { year, result };
    }),
  );

  const successes = summaries.filter((entry) => entry.result.status === "success");
  const failures = summaries.filter((entry) => entry.result.status === "failed");

  console.log(`\nSummary: ${successes.length} succeeded / ${failures.length} failed.`);

  failures.forEach((entry) => {
    const reason = entry.result.status === "failed" ? entry.result.reason : "unknown";
    console.warn(`Year ${entry.year} failed: ${reason}`);
  });
});

program.parseAsync();
