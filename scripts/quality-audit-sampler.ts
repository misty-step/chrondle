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
import { hasLeakage, hasProperNoun, isValidWordCount } from "../convex/lib/eventValidation";

interface AuditResult {
  year: number;
  event: string;
  used: boolean;
  issues: string[];
}

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
  .name("quality-audit-sampler")
  .description("Sample events for manual quality checks")
  .option("--count <count>", "Number of events to sample", "10")
  .option("--unused-only", "Consider only events not yet used in puzzles", false)
  .option("--year <year>", "Focus on a specific year")
  .option("--json", "Output JSON instead of readable text", false);

program.action(async (options) => {
  const count = Number(options.count) || 10;
  const client = await getClient();

  const stats = await client.query(api.events.getAllYearsWithStats, {});
  const candidateYears = options.year
    ? [Number(options.year)]
    : stats.map((stat: any) => stat.year);

  if (!candidateYears.length) {
    console.error("No years available to sample.");
    process.exit(1);
  }

  const results: AuditResult[] = [];
  let attempts = 0;

  while (results.length < count && attempts < count * 5) {
    attempts += 1;
    const year = candidateYears[Math.floor(Math.random() * candidateYears.length)];
    const events = await client.query(api.events.getYearEvents, { year });
    const filtered = options.unusedOnly ? events.filter((event: any) => !event.puzzleId) : events;
    if (!filtered.length) continue;
    const event = filtered[Math.floor(Math.random() * filtered.length)];
    const issues: string[] = [];
    if (hasLeakage(event.event)) {
      issues.push("leakage detected");
    }
    if (!hasProperNoun(event.event)) {
      issues.push("missing proper noun");
    }
    if (!isValidWordCount(event.event, 20)) {
      issues.push("exceeds word limit");
    }

    results.push({
      year,
      event: event.event,
      used: Boolean(event.puzzleId),
      issues,
    });
  }

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Sampled ${results.length} events (attempted ${attempts})`);
    results.forEach((result, index) => {
      const status = result.issues.length ? "⚠️" : "✅";
      console.log(`\n${index + 1}. [${result.year}] ${status}`);
      console.log(`   ${result.event}`);
      console.log(`   Used: ${result.used ? "yes" : "no"}`);
      if (result.issues.length) {
        console.log(`   Issues: ${result.issues.join(", ")}`);
      }
    });
  }
});

program.parseAsync();
