#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeRoots = [
  ".env.example",
  ".vercelignore",
  ".github/workflows",
  "AGENTS.md",
  "GEMINI.md",
  "README.md",
  "convex/SETUP.md",
  "dagger/src",
  "docs",
  "e2e",
  "next.config.ts",
  "package.json",
  "scripts",
  "src",
  "vercel.json",
];

const excludedPaths = new Set([
  "docs/archive",
  "scripts/check-provider-retirement.mjs",
  "scripts/check-provider-retirement.test.mjs",
]);

const retiredProviderPattern = /\bvercel(?:\.com)?\b|\bVERCEL(?:_[A-Z0-9_]+)?\b/gi;

async function collectFiles(relativePath) {
  if (excludedPaths.has(relativePath)) return [];

  const absolutePath = path.join(projectRoot, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
  if (!entries) return [relativePath];

  const nested = await Promise.all(
    entries.map((entry) => collectFiles(path.join(relativePath, entry.name))),
  );
  return nested.flat();
}

export async function findRetiredProviderReferences() {
  const files = (await Promise.all(activeRoots.map(collectFiles))).flat();
  const findings = [];

  for (const relativePath of files.sort()) {
    const content = await readFile(path.join(projectRoot, relativePath), "utf8").catch(() => null);
    if (content === null) continue;

    retiredProviderPattern.lastIndex = 0;
    if (retiredProviderPattern.test(relativePath)) {
      findings.push(`${relativePath}:1: provider-specific file is present`);
    }

    for (const [index, line] of content.split("\n").entries()) {
      retiredProviderPattern.lastIndex = 0;
      if (retiredProviderPattern.test(line)) {
        findings.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  return findings;
}

async function main() {
  const findings = await findRetiredProviderReferences();
  if (findings.length > 0) {
    console.error("Retired hosting provider references remain in active Chrondle surfaces:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  console.log("PASS: active Chrondle surfaces are provider-retirement clean");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
