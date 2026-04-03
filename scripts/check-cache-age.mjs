#!/usr/bin/env node
/**
 * Cache Age Monitoring Script
 *
 * Checks the age of various cache directories and warns if they're too old.
 * Helps prevent stale cache issues that can cause "ancient UI" problems.
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, statSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Configuration
const CACHE_PATHS = [
  {
    path: ".next",
    name: "Next.js Cache",
    maxAgeDays: 7,
    severity: "high",
    description: "Contains compiled components and pages",
  },
  {
    path: "tsconfig.tsbuildinfo",
    name: "TypeScript Build Cache",
    maxAgeDays: 14,
    severity: "medium",
    description: "TypeScript incremental compilation cache",
  },
  {
    path: "node_modules/.cache",
    name: "Node Modules Cache",
    maxAgeDays: 30,
    severity: "low",
    description: "Various Node.js tool caches",
  },
];

function getCacheAge(cachePath) {
  const fullPath = join(projectRoot, cachePath);

  if (!existsSync(fullPath)) {
    return null; // Cache doesn't exist
  }

  const stats = statSync(fullPath);
  const ageMs = Date.now() - stats.mtime.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  return {
    exists: true,
    ageDays,
    ageMs,
    lastModified: stats.mtime,
    path: fullPath,
  };
}

function formatAge(ageDays) {
  if (ageDays === 0) return "today";
  if (ageDays === 1) return "1 day ago";
  if (ageDays < 7) return `${ageDays} days ago`;
  if (ageDays < 14) return `${Math.floor(ageDays / 7)} week${ageDays >= 14 ? "s" : ""} ago`;
  return `${ageDays} days ago`;
}

function getSeverityEmoji(severity) {
  switch (severity) {
    case "high":
      return "🚨";
    case "medium":
      return "⚠️";
    case "low":
      return "ℹ️";
    default:
      return "📋";
  }
}

function main() {
  console.log("🔍 Checking cache age...\n");

  let hasWarnings = false;
  let hasErrors = false;

  for (const cache of CACHE_PATHS) {
    const info = getCacheAge(cache.path);

    if (!info) {
      console.log(`✅ ${cache.name}: Not present (clean)`);
      continue;
    }

    const isOld = info.ageDays > cache.maxAgeDays;
    const emoji = getSeverityEmoji(isOld ? cache.severity : "low");

    if (isOld) {
      console.log(`${emoji} ${cache.name}: ${formatAge(info.ageDays)} (${cache.description})`);
      console.log(`   Path: ${cache.path}`);
      console.log(`   Recommended: Clear cache if experiencing UI issues\n`);

      if (cache.severity === "high") {
        hasErrors = true;
      } else {
        hasWarnings = true;
      }
    } else {
      console.log(`✅ ${cache.name}: ${formatAge(info.ageDays)} (fresh)`);
    }
  }

  if (hasErrors || hasWarnings) {
    console.log("\n💡 Quick fixes:");
    console.log("   bun run clean:next # Clear Next.js cache only");
    console.log("   bun run clean      # Clear all caches");
    console.log("   bun run clean:dev  # Clear cache and restart dev server");
    console.log("   bun run fresh      # Nuclear option: clean, reinstall, restart");
  }

  if (hasErrors) {
    console.log("\n🚨 High priority cache issues detected!");
    process.exit(1);
  } else if (hasWarnings) {
    console.log("\n⚠️  Some caches are getting old, consider clearing if you experience issues.");
    process.exit(0);
  } else {
    console.log("\n✅ All caches are fresh!");
    process.exit(0);
  }
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { getCacheAge, CACHE_PATHS };
