#!/usr/bin/env tsx
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
  try {
    const envContent = await fs.readFile(envPath, "utf-8");
    Object.assign(process.env, dotenv.parse(envContent));
  } catch {
    console.warn("Could not load .env.local, relying on process.env");
  }
}

async function getClient(): Promise<ConvexHttpClient> {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

const DEFAULT_TOTAL_YEARS = 50;
const DEFAULT_CONCURRENCY = 50;
const DEFAULT_START_YEAR = 1850;

function parseNumberArg(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getLoadTestConfig() {
  // CLI usage: tsx scripts/load-test-batch.ts [totalYears] [concurrency] [startYear]
  const totalYearsFromArg = parseNumberArg(process.argv[2]);
  const concurrencyFromArg = parseNumberArg(process.argv[3]);
  const startYearFromArg = parseNumberArg(process.argv[4]);

  const totalYearsEnv = parseNumberArg(process.env.LOAD_TEST_YEARS);
  const concurrencyEnv = parseNumberArg(process.env.LOAD_TEST_CONCURRENCY);
  const startYearEnv = parseNumberArg(process.env.LOAD_TEST_START_YEAR);

  const totalYears = totalYearsFromArg ?? totalYearsEnv ?? DEFAULT_TOTAL_YEARS;
  const concurrency = concurrencyFromArg ?? concurrencyEnv ?? DEFAULT_CONCURRENCY;
  const startYear = startYearFromArg ?? startYearEnv ?? DEFAULT_START_YEAR;

  return { totalYears, concurrency, startYear } as const;
}

async function runLoadTest() {
  const { totalYears, concurrency, startYear } = getLoadTestConfig();

  console.log(
    `Starting Batch Processing Load Test (targetYears=${totalYears}, concurrency=${concurrency})...`,
  );
  const client = await getClient();

  // Generate a contiguous block of years for the load test.
  const years = Array.from({ length: totalYears }, (_, i) => startYear + i);
  console.log(`Targeting years: ${years[0]} - ${years[years.length - 1]}`);

  const startTime = performance.now();
  const memStart = process.memoryUsage();

  let completed = 0;
  let failed = 0;
  let rateLimited = 0;

  const batches: number[][] = [];
  for (let i = 0; i < years.length; i += concurrency) {
    batches.push(years.slice(i, i + concurrency));
  }

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1}/${batches.length}: ${batch.join(", ")}`);

    const promises = batch.map(async (year) => {
      try {
        const result = await client.action(
          api.actions.eventGeneration.orchestrator.testGenerateYearEvents,
          { year },
        );
        if (result.status === "success") {
          completed += 1;
        } else {
          failed += 1;
        }
      } catch (e: any) {
        const message = e?.message ?? String(e);
        if (message.includes("429") || message.toLowerCase().includes("too many requests")) {
          rateLimited += 1;
        }
        console.error(`Year ${year} failed to invoke:`, message);
        failed += 1;
      }
    });

    await Promise.all(promises);
  }

  const durationMs = performance.now() - startTime;
  const elapsedSeconds = durationMs / 1000;
  const memEnd = process.memoryUsage();

  const bytesToMb = (bytes: number) => bytes / 1024 / 1024;
  const rssStartMb = bytesToMb(memStart.rss);
  const rssEndMb = bytesToMb(memEnd.rss);
  const rssDeltaMb = rssEndMb - rssStartMb;

  console.log("\n--- Load Test Summary ---");
  console.log(`Total Duration: ${elapsedSeconds.toFixed(2)}s`);
  console.log(`Throughput: ${(totalYears / Math.max(1, elapsedSeconds)).toFixed(2)} years/sec`);
  console.log(`Success: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Rate-limited (HTTP 429 style): ${rateLimited}`);
  console.log("\nApproximate Node process memory usage (RSS):");
  console.log(`  Start: ${rssStartMb.toFixed(2)} MB`);
  console.log(`  End:   ${rssEndMb.toFixed(2)} MB`);
  console.log(`  Delta: ${rssDeltaMb.toFixed(2)} MB`);
}

runLoadTest().catch((error) => {
  console.error("Load test failed with unexpected error:", error);
  process.exitCode = 1;
});
