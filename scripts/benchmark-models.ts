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

// Schema for benchmark
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

async function benchmarkGemini3() {
  console.log("\n--- Benchmarking Gemini 3 (Pro Preview) ---");
  const client = createGemini3Client({
    apiKey: process.env.OPENROUTER_API_KEY,
    model: "google/gemini-3-pro-preview",
    thinking_level: "high",
    cache_system_prompt: false, // Disable cache for fair latency test
  });

  const start = performance.now();
  try {
    const result = await client.generate({
      system: "You are a historical event generator.",
      user: `Generate 6 historical events for the year ${TEST_YEAR} ${TEST_ERA}.`,
      schema: BenchmarkSchema,
      metadata: { benchmark: true },
    });
    const duration = performance.now() - start;
    console.log(`Success! Duration: ${duration.toFixed(2)}ms`);
    console.log(`Cost: $${result.cost.totalUsd.toFixed(6)}`);
    console.log(`Events generated: ${result.data.candidates.length}`);
    return { duration, success: true };
  } catch (error: any) {
    console.error("Gemini 3 failed:", error.message);
    return { duration: 0, success: false };
  }
}

async function benchmarkGPT5Mini() {
  console.log("\n--- Benchmarking GPT-5-mini (via LLMClient) ---");
  const client = createLLMClient({
    apiKey: process.env.OPENROUTER_API_KEY,
    modelPriority: ["openai/gpt-5-mini"], // Force GPT-5-mini
  });

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
    console.log(`Success! Duration: ${duration.toFixed(2)}ms`);
    console.log(`Cost: $${(result.usage.costUsd ?? 0).toFixed(6)}`);
    console.log(`Events generated: ${result.data.candidates.length}`);
    return { duration, success: true };
  } catch (error: any) {
    console.error("GPT-5-mini failed:", error.message);
    return { duration: 0, success: false };
  }
}

async function runBenchmark() {
  console.log("Starting Latency Benchmark...");

  // Warmup (optional, but good for network paths)
  // await new Promise(resolve => setTimeout(resolve, 1000));

  const geminiResult = await benchmarkGemini3();
  const gptResult = await benchmarkGPT5Mini();

  console.log("\n--- Results ---");
  if (geminiResult.success && gptResult.success) {
    const diff = geminiResult.duration - gptResult.duration;
    const pct = (diff / gptResult.duration) * 100;
    console.log(
      `Gemini 3 is ${Math.abs(diff).toFixed(2)}ms ${diff > 0 ? "slower" : "faster"} than GPT-5-mini (${Math.abs(pct).toFixed(1)}%)`,
    );
  } else {
    console.log("Benchmark incomplete due to failures.");
  }
}

runBenchmark();
