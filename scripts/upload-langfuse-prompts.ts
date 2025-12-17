#!/usr/bin/env tsx
/**
 * Upload prompts to Langfuse for versioning and A/B testing.
 *
 * Usage: pnpm tsx scripts/upload-langfuse-prompts.ts
 */

import { LangfuseClient } from "@langfuse/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

const PROMPTS_DIR = path.join(process.cwd(), "evals/prompts");

interface PromptConfig {
  name: string;
  file: string;
  labels: string[];
}

const PROMPT_CONFIGS: PromptConfig[] = [
  { name: "chrondle-generator", file: "generator.v1.txt", labels: ["latest", "production"] },
  { name: "chrondle-critic", file: "critic.v1.txt", labels: ["latest", "production"] },
  { name: "chrondle-reviser", file: "reviser.v1.txt", labels: ["latest", "production"] },
];

async function main() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  const host = (process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST)?.trim();

  if (!publicKey || !secretKey) {
    console.error("❌ Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY in .env.local");
    process.exit(1);
  }

  console.log("🔗 Connecting to Langfuse...");
  console.log(`   Host: ${host || "https://cloud.langfuse.com"}`);

  // v4: Use LangfuseClient instead of Langfuse class
  const langfuse = new LangfuseClient({
    publicKey,
    secretKey,
    baseUrl: host,
  });

  for (const config of PROMPT_CONFIGS) {
    const filePath = path.join(PROMPTS_DIR, config.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping ${config.name}: file not found at ${filePath}`);
      continue;
    }

    const promptText = fs.readFileSync(filePath, "utf-8");

    console.log(`\n📝 Uploading: ${config.name}`);
    console.log(`   File: ${config.file}`);
    console.log(`   Labels: ${config.labels.join(", ")}`);
    console.log(`   Length: ${promptText.length} chars`);

    try {
      // v4: Create prompt via client.prompt.create()
      await langfuse.prompt.create({
        name: config.name,
        prompt: promptText,
        labels: config.labels,
        type: "text",
      });

      console.log(`   ✅ Uploaded successfully`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        console.log(`   ⏭️  Prompt already exists (skipping)`);
      } else {
        console.error(`   ❌ Failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  console.log("\n✨ Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
