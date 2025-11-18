#!/usr/bin/env tsx

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Command } from "commander";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
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
  .name("cost-analysis")
  .description("Analyze event generation cost and token usage over recent days")
  .option("--days <days>", "Number of days to inspect (default 14)")
  .option("--alert <usd>", "Warn if any day exceeds this USD amount")
  .option("--json", "Output raw JSON instead of pretty table");

program.action(async (options) => {
  const days = Number(options.days) || 14;
  const alertThreshold = options.alert ? Number(options.alert) : undefined;
  const client = await getClient();

  const buckets = await client.query(api.generationLogs.getLast7DaysCosts, { days });

  const totalCost = buckets.reduce((sum: number, bucket: any) => sum + bucket.totalCost, 0);
  const totalEvents = buckets.reduce((sum: number, bucket: any) => sum + bucket.eventsGenerated, 0);
  const averageCost = buckets.length ? totalCost / buckets.length : 0;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          days,
          totalCost,
          totalEvents,
          averageCost,
          buckets,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Cost analysis for last ${days} days`);
    console.log("-----------------------------------");
    buckets.forEach((bucket: any) => {
      const warn = alertThreshold && bucket.totalCost >= alertThreshold ? " ⚠️" : "";
      console.log(
        `${bucket.date}: $${bucket.totalCost.toFixed(2)} (${bucket.eventsGenerated} events, ${Math.round(bucket.successRate * 100)}% pass)${warn}`,
      );
    });
    console.log("-----------------------------------");
    console.log(`Total cost: $${totalCost.toFixed(2)}`);
    console.log(`Average daily cost: $${averageCost.toFixed(2)}`);
    console.log(`Events generated: ${totalEvents}`);
  }

  if (alertThreshold) {
    const breaches = buckets.filter((bucket: any) => bucket.totalCost >= alertThreshold);
    if (breaches.length) {
      console.warn(
        `⚠️ ${breaches.length} day(s) exceeded the $${alertThreshold.toFixed(2)} threshold.`,
      );
    } else {
      console.log("✅ No cost breaches detected.");
    }
  }
});

program.parseAsync();
