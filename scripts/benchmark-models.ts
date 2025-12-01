#!/usr/bin/env tsx
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createGemini3Client } from "../convex/lib/gemini3Client.js";
import { createLLMClient } from "../convex/lib/llmClient.js";
import { z } from "zod";
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
  Object.assign(process.env, dotenv.parse(envContent));
} catch {
  console.warn("Could not load .env.local, relying on process.env");
}

const TEST_YEAR = 1969;
const TEST_ERA = "CE";
const DEFAULT_RUNS = 10;

function getRunCount(): number {
  const arg = process.argv[2];
  const fromArg = arg ? Number.parseInt(arg, 10) : Number.NaN;
  if (Number.isFinite(fromArg) && fromArg > 0) {
    return fromArg;
  }

  const envRuns = process.env.BENCH_RUNS;
  const fromEnv = envRuns ? Number.parseInt(envRuns, 10) : Number.NaN;
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }

  return DEFAULT_RUNS;
}

interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
}

function computeLatencyStats(durationsMs: number[]): LatencyStats | null {
  if (durationsMs.length === 0) {
    return null;
  }

  const sorted = [...durationsMs].sort((a, b) => a - b);
  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    const clampedIndex = Math.min(sorted.length - 1, Math.max(0, index));
    return sorted[clampedIndex];
  };

  return {
    count: sorted.length,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

const BenchmarkSchema = z.object({
  year: z.object({
    value: z.number(),
    era: z.string(),
    digits: z.number(),
  }),
  candidates: z.array(
    z.object({
      event_text: z.string(),
      confidence: z.number(),
    }),
  ),
});

async function benchmarkGemini3(runs: number) {
  console.log(`\n--- Benchmarking Gemini 3 (Pro Preview) — ${runs} run(s) ---`);
  const client = createGemini3Client({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: "google/gemini-3-pro-preview",
    thinking_level: "high",
    cache_system_prompt: false, // Disable cache for fair latency test
  });

  const durations: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < runs; i += 1) {
    console.log(`\n[Gemini 3] Run ${i + 1}/${runs}...`);
    const start = performance.now();
    try {
      const result = await client.generate({
        system: "You are a historical event generator.",
        user: `Generate 6 historical events for the year ${TEST_YEAR} ${TEST_ERA}.`,
        schema: BenchmarkSchema,
        metadata: { benchmark: true },
      });
      const duration = performance.now() - start;
      durations.push(duration);
      successCount += 1;
      console.log(`Success! Duration: ${duration.toFixed(2)}ms`);
      console.log(`Cost: $${result.cost.totalUsd.toFixed(6)}`);
      console.log(`Events generated: ${result.data.candidates.length}`);
    } catch (error: any) {
      failureCount += 1;
      console.error("Gemini 3 failed:", error.message);
    }
  }

  const stats = computeLatencyStats(durations);
  if (!stats) {
    console.log("No successful Gemini 3 runs; skipping latency stats.");
  }

  return { stats, successCount, failureCount } as const;
}

async function benchmarkGPT5Mini(runs: number) {
  console.log(`\n--- Benchmarking GPT-5-mini (via LLMClient) — ${runs} run(s) ---`);
  const client = createLLMClient({
    apiKey: process.env.OPENROUTER_API_KEY,
    modelPriority: ["openai/gpt-5-mini"], // Force GPT-5-mini
  });

  const durations: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < runs; i += 1) {
    console.log(`\n[GPT-5-mini] Run ${i + 1}/${runs}...`);
    const start = performance.now();
    try {
      const result = await client.generate({
        prompt: {
          system: "You are a historical event generator.",
          user: `Generate 6 historical events for the year ${TEST_YEAR} ${TEST_ERA}. Return valid JSON.`,
        },
        schema: BenchmarkSchema,
      });
      const duration = performance.now() - start;
      durations.push(duration);
      successCount += 1;
      console.log(`Success! Duration: ${duration.toFixed(2)}ms`);
      console.log(`Cost: $${(result.usage.costUsd ?? 0).toFixed(6)}`);
      console.log(`Events generated: ${result.data.candidates.length}`);
    } catch (error: any) {
      failureCount += 1;
      console.error("GPT-5-mini failed:", error.message);
    }
  }

  const stats = computeLatencyStats(durations);
  if (!stats) {
    console.log("No successful GPT-5-mini runs; skipping latency stats.");
  }

  return { stats, successCount, failureCount } as const;
}

function logLatencySummary(label: string, stats: LatencyStats | null) {
  if (!stats) {
    console.log(`${label}: no successful runs`);
    return;
  }

  const toSeconds = (ms: number) => (ms / 1000).toFixed(2);

  console.log(`${label}:`);
  console.log(`  samples: ${stats.count}`);
  console.log(`  p50: ${stats.p50.toFixed(2)}ms (${toSeconds(stats.p50)}s)`);
  console.log(`  p95: ${stats.p95.toFixed(2)}ms (${toSeconds(stats.p95)}s)`);
  console.log(`  p99: ${stats.p99.toFixed(2)}ms (${toSeconds(stats.p99)}s)`);
}

async function runBenchmark() {
  const runs = getRunCount();
  console.log(`Starting Latency Benchmark with ${runs} run(s) per model...`);
  console.log(
    "Note: This will make real OpenRouter calls; ensure OPENROUTER_API_KEY is set and be aware of token costs.\n",
  );

  const gemini = await benchmarkGemini3(runs);
  const gpt5 = await benchmarkGPT5Mini(runs);

  console.log("\n--- Latency Summary (ms) ---");
  logLatencySummary("Gemini 3", gemini.stats);
  logLatencySummary("GPT-5-mini", gpt5.stats);

  if (gemini.stats && gpt5.stats) {
    const geminiP95Sec = gemini.stats.p95 / 1000;
    const p95Diff = gemini.stats.p95 - gpt5.stats.p95;
    const p95RegressionPct = (p95Diff / gpt5.stats.p95) * 100;

    console.log("\n--- Regression & Acceptance Checks ---");
    console.log(
      `Gemini 3 p95: ${geminiP95Sec.toFixed(2)}s (${geminiP95Sec < 30 ? "OK < 30s" : "ABOVE 30s"})`,
    );
    console.log(
      `p95 regression vs GPT-5-mini: ${p95RegressionPct.toFixed(1)}% (${p95RegressionPct <= 20 ? "within 20%" : "above 20%"})`,
    );
  } else {
    console.log("\nSkipping regression checks because one or both models had no successful runs.");
  }

  console.log("\n--- Run Summary ---");
  console.log(`Gemini 3: ${gemini.successCount} success, ${gemini.failureCount} failure(s)`);
  console.log(`GPT-5-mini: ${gpt5.successCount} success, ${gpt5.failureCount} failure(s)`);
}

runBenchmark();
