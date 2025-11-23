#!/usr/bin/env node

/**
 * Diagnostic tool for Vercel deployment failures.
 * Helps quickly identify common causes and provides actionable solutions.
 */

import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bright: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title) {
  log("\n" + "═".repeat(60), colors.cyan);
  log(`  ${title}`, colors.bright + colors.cyan);
  log("═".repeat(60), colors.cyan);
}

async function diagnoseVercelFailure() {
  log("\n🔍 Vercel Deployment Diagnostic Tool", colors.bright + colors.cyan);
  log("Version 1.0 - Chrondle Project\n", colors.dim);

  const issues = [];
  const solutions = [];

  // Introduction
  header("COMMON VERCEL FAILURE CAUSES");

  log("\n📋 This tool will check for:", colors.blue);
  log("   1. Missing Convex generated files");
  log("   2. Environment variable configuration");
  log("   3. Build command misconfiguration");
  log("   4. TypeScript compilation errors");
  log("   5. Git tracking issues");

  // Check 1: Convex Generated Files
  header("CHECK 1: CONVEX GENERATED FILES");

  const requiredFiles = [
    "convex/_generated/api.d.ts",
    "convex/_generated/api.js",
    "convex/_generated/dataModel.d.ts",
    "convex/_generated/server.d.ts",
    "convex/_generated/server.js",
  ];

  log("\nChecking local files...", colors.dim);
  const missingLocally = requiredFiles.filter((file) => !existsSync(file));

  if (missingLocally.length > 0) {
    log("❌ Missing files locally:", colors.red);
    missingLocally.forEach((file) => log(`   - ${file}`, colors.red));
    issues.push("Convex files missing locally");
    solutions.push("Run: npx convex codegen");
  } else {
    log("✅ All files exist locally", colors.green);
  }

  // Check if files are in Git
  try {
    log("\nChecking Git status...", colors.dim);
    const { stdout } = await execAsync("git ls-tree HEAD convex/_generated/");
    const filesInGit = stdout.split("\n").filter((line) => line.trim()).length;

    if (filesInGit < 5) {
      log(`❌ Only ${filesInGit}/5 files in Git`, colors.red);
      issues.push("Convex files not committed to Git");
      solutions.push('Run: git add convex/_generated/ && git commit -m "fix: add Convex files"');
    } else {
      log("✅ All files committed to Git", colors.green);
    }
  } catch (error) {
    log("⚠️  Could not check Git status", colors.yellow);
  }

  // Check 2: Environment Variables
  header("CHECK 2: ENVIRONMENT VARIABLES");

  log("\n📝 Required in Vercel Dashboard:", colors.blue);
  log("   • CONVEX_DEPLOYMENT=fleet-goldfish-183", colors.cyan);
  log("   • NEXT_PUBLIC_CONVEX_URL=https://fleet-goldfish-183.convex.cloud", colors.cyan);
  log("   • NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", colors.cyan);
  log("   • OPENROUTER_API_KEY (for server-side context generation)", colors.cyan);

  log(
    "\n💡 Check at: https://vercel.com/your-team/chrondle/settings/environment-variables",
    colors.dim,
  );

  // Check 3: Build Command Configuration
  header("CHECK 3: BUILD CONFIGURATION");

  if (existsSync("vercel.json")) {
    const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));

    if (vercelConfig.buildCommand?.includes("convex codegen")) {
      log("❌ Invalid buildCommand detected", colors.red);
      log("   Found: " + vercelConfig.buildCommand, colors.dim);
      issues.push("vercel.json has incorrect buildCommand");
      solutions.push("Remove buildCommand from vercel.json (use minimal config)");
    } else if (vercelConfig.buildCommand) {
      log("⚠️  Custom buildCommand: " + vercelConfig.buildCommand, colors.yellow);
      log("   Default Next.js build is usually sufficient", colors.dim);
    } else {
      log("✅ Using default build configuration", colors.green);
    }
  } else {
    log("✅ No vercel.json (using defaults)", colors.green);
  }

  // Check 4: TypeScript Compilation
  header("CHECK 4: TYPESCRIPT COMPILATION");

  log("\nRunning type check...", colors.dim);
  try {
    await execAsync("npx tsc --noEmit");
    log("✅ No TypeScript errors", colors.green);
  } catch (error) {
    log("❌ TypeScript compilation errors found", colors.red);
    issues.push("TypeScript compilation errors");
    solutions.push("Fix TypeScript errors: pnpm type-check");
  }

  // Check 5: Common Gotchas
  header("CHECK 5: COMMON GOTCHAS");

  // Check if convex/_generated is in .gitignore
  if (existsSync(".gitignore")) {
    const gitignore = readFileSync(".gitignore", "utf8");
    if (gitignore.includes("convex/_generated/") && !gitignore.includes("# convex/_generated/")) {
      log("❌ convex/_generated/ is in .gitignore!", colors.red);
      issues.push("Generated files are gitignored");
      solutions.push('Remove or comment out "convex/_generated/" from .gitignore');
    } else {
      log("✅ .gitignore configuration correct", colors.green);
    }
  }

  // Results Summary
  header("DIAGNOSTIC RESULTS");

  if (issues.length === 0) {
    log("\n✅ No local issues detected!", colors.green);
    log("\nIf Vercel is still failing, check:", colors.yellow);
    log("   1. Environment variables in Vercel dashboard");
    log("   2. Vercel build logs for specific errors");
    log("   3. Network/API connectivity issues");
  } else {
    log("\n❌ Found " + issues.length + " issue(s):", colors.red);
    issues.forEach((issue, i) => {
      log(`\n${i + 1}. ${issue}`, colors.red);
      if (solutions[i]) {
        log(`   Solution: ${solutions[i]}`, colors.cyan);
      }
    });
  }

  // Quick Fix Commands
  header("QUICK FIX COMMANDS");

  log("\n🔧 Common fixes:", colors.blue);
  log("\n# Regenerate and commit Convex files:");
  log("npx convex codegen", colors.cyan);
  log("git add convex/_generated/", colors.cyan);
  log('git commit -m "fix: restore Convex generated files"', colors.cyan);
  log("git push", colors.cyan);

  log("\n# Check deployment readiness:");
  log("pnpm deployment:check", colors.cyan);

  log("\n# Verify Convex files specifically:");
  log("pnpm verify:convex", colors.cyan);

  // Additional Resources
  header("ADDITIONAL RESOURCES");

  log("\n📚 Documentation:", colors.blue);
  log("   • convex/_generated/README.md - Why these files are special");
  log("   • docs/guides/contributing.md - Convex section");
  log("   • .env.example - Environment variable reference");

  log("\n🔗 Useful Links:", colors.blue);
  log("   • Vercel Dashboard: https://vercel.com");
  log("   • Convex Dashboard: https://dashboard.convex.dev");
  log("   • PR Checks: https://github.com/phrazzld/chrondle/pulls");

  log("\n💡 Still stuck? Check the Vercel build logs for specific error messages.", colors.yellow);
  log("", colors.reset);
}

// Run diagnostic
diagnoseVercelFailure().catch((error) => {
  log(`\n❌ Diagnostic tool error: ${error.message}`, colors.red);
  process.exit(1);
});
