#!/usr/bin/env tsx
/* eslint-disable no-console */

import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api.js";
import dotenv from "dotenv";
import { z } from "zod";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createGemini3Client } from "../convex/lib/gemini3Client.js";

const BATCH_SIZE = 50;
const MODEL = "google/gemini-3-flash-preview";

const MetadataSchema = z.array(
  z.object({
    difficulty: z.number().min(1).max(5),
    category: z.array(z.string()).min(1),
    era: z.enum(["ancient", "medieval", "modern"]),
    fame_level: z.number().min(1).max(5),
    tags: z.array(z.string()).min(1),
  }),
);

async function loadEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = join(__dirname, "../.env.local");
  try {
    const content = await fs.readFile(envPath, "utf-8");
    Object.assign(process.env, dotenv.parse(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to load ${envPath}:`, message);
    process.exit(1);
  }
}

async function getConvexClient() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    console.error("NEXT_PUBLIC_CONVEX_URL is missing");
    process.exit(1);
  }
  return new ConvexHttpClient(url);
}

function buildPrompt(batch: Array<{ year: number; event: string }>): string {
  const lines = batch.map((item, idx) => `${idx + 1}. (${item.year}) ${item.event}`).join("\n");

  return `You are a metadata annotator for historical events.

For each event, produce JSON array of objects with fields:
- difficulty: integer 1-5 (1 easy, 5 very obscure)
- category: array of categories from ["war","politics","science","culture","technology","religion","economy","sports","exploration","arts"]
- era: "ancient" (<500 CE), "medieval" (500-1500 CE), "modern" (1500+ CE)
- fame_level: integer 1-5 (public awareness)
- tags: 2-5 short tags

Events:
${lines}

Return ONLY JSON array with same order and length (${batch.length}).`;
}

async function backfill() {
  const convex = await getConvexClient();
  const client = createGemini3Client({
    model: MODEL,
    thinking_level: "low",
    structured_outputs: true,
    cache_system_prompt: true,
  });

  const missing = await convex.query(internal.events.getEventsMissingMetadata, {
    limit: 1000,
  });

  if (missing.length === 0) {
    console.log("✅ No events need metadata");
    return;
  }

  console.log(`⚙️  Backfilling metadata for ${missing.length} events...`);

  let processed = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const prompt = buildPrompt(batch);

    const response = await client.generate({
      system: "Annotate historical events with metadata only.",
      user: prompt,
      schema: MetadataSchema,
      options: {
        model: MODEL,
        thinking_level: "low",
        structured_outputs: true,
        cache_system_prompt: true,
      },
    });

    const items = response.data;
    if (items.length !== batch.length) {
      throw new Error(`Metadata length mismatch: expected ${batch.length}, got ${items.length}`);
    }

    for (let j = 0; j < batch.length; j += 1) {
      const meta = items[j];
      const event = batch[j];
      await convex.mutation(internal.events.updateEventMetadata, {
        eventId: event._id,
        metadata: meta,
      });
      processed += 1;
    }

    console.log(
      `✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: added metadata for ${batch.length} events (total ${processed}/${missing.length})`,
    );
  }

  console.log("🎉 Metadata backfill complete!");
}

backfill().catch((error) => {
  console.error("❌ Backfill failed:", error);
  process.exit(1);
});
