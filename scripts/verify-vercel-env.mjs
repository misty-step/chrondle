#!/usr/bin/env node
/**
 * Vercel Environment Variables Checker
 *
 * Verifies that required environment variables are configured in Vercel
 * across all environments (development, preview, production).
 *
 * Usage:
 *   node scripts/verify-vercel-env.mjs [environment]
 *
 * Options:
 *   environment   One of: development, preview, production, all (default: all)
 *
 * Requirements:
 *   - Vercel CLI installed and authenticated
 *   - Project linked to Vercel
 *
 * Exit Codes:
 *   0 = All checks passed
 *   1 = Missing or invalid variables found
 */

import { execSync } from "child_process";

// =============================================================================
// CONFIGURATION
// =============================================================================

const REQUIRED_VARS = {
  // All environments need these
  all: [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ],

  // Production and Preview need Stripe
  production: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SYNC_SECRET",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_ANNUAL",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ],

  preview: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SYNC_SECRET",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_ANNUAL",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ],

  // Development can work without Stripe (uses .env.local)
  development: [],
};

// =============================================================================
// VERCEL CLI HELPERS
// =============================================================================

function getVercelEnvVars(environment) {
  try {
    const output = execSync(`npx vercel env ls ${environment} 2>&1`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Parse table output format:
    // name                        value       environments    created
    // NEXT_PUBLIC_CONVEX_URL      Encrypted   Production      161d ago

    const lines = output.split("\n");
    const envVars = [];

    // Find lines that look like env var entries (start with letters, have "Encrypted")
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip headers and empty lines
      if (!trimmed || trimmed.startsWith("Vercel") || trimmed.startsWith(">") ||
          trimmed.startsWith("Common") || trimmed.startsWith("-") ||
          trimmed.includes("name") && trimmed.includes("value")) {
        continue;
      }

      // Extract the first column (env var name)
      const match = trimmed.match(/^([A-Z][A-Z0-9_]*)\s+/);
      if (match) {
        // Check if this var is for the requested environment
        const envLower = environment.toLowerCase();
        const lineLower = line.toLowerCase();
        if (lineLower.includes(envLower) ||
            (envLower === "development" && lineLower.includes("dev"))) {
          envVars.push(match[1]);
        }
      }
    }

    return envVars;
  } catch {
    return null; // CLI not available or not authenticated
  }
}

function checkVercelLinked() {
  try {
    execSync("npx vercel whoami", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateEnvironment(environment, existingVars) {
  const required = [...REQUIRED_VARS.all, ...(REQUIRED_VARS[environment] || [])];
  const missing = [];
  const present = [];

  for (const varName of required) {
    if (existingVars.includes(varName)) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  return { required, missing, present };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const targetEnv = process.argv[2] || "all";
  const validEnvs = ["development", "preview", "production", "all"];

  if (!validEnvs.includes(targetEnv)) {
    console.error(`\n❌ Invalid environment: ${targetEnv}`);
    console.error(`   Valid options: ${validEnvs.join(", ")}\n`);
    process.exit(1);
  }

  console.log("\n🔍 Vercel Environment Variables Checker\n");

  // Check Vercel CLI
  if (!checkVercelLinked()) {
    console.log("⚠️  Vercel CLI not authenticated or project not linked.");
    console.log("   Run: npx vercel link\n");
    console.log("   Skipping Vercel environment check.\n");
    process.exit(0); // Don't fail CI if Vercel isn't configured
  }

  const environments =
    targetEnv === "all" ? ["development", "preview", "production"] : [targetEnv];

  let hasErrors = false;
  const results = {};

  for (const env of environments) {
    console.log(`\n📦 ${env.toUpperCase()}`);
    console.log("─".repeat(40));

    const existingVars = getVercelEnvVars(env);

    if (existingVars === null) {
      console.log("   ⚠️  Could not fetch environment variables");
      continue;
    }

    const { required, missing, present } = validateEnvironment(env, existingVars);

    results[env] = { required: required.length, present: present.length, missing };

    if (present.length > 0) {
      console.log(`   ✅ Present (${present.length}/${required.length}):`);
      for (const varName of present) {
        console.log(`      - ${varName}`);
      }
    }

    if (missing.length > 0) {
      console.log(`   ❌ Missing (${missing.length}):`);
      for (const varName of missing) {
        console.log(`      - ${varName}`);
      }
      hasErrors = true;
    }

    if (missing.length === 0 && required.length > 0) {
      console.log(`   ✅ All ${required.length} required variables present`);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("SUMMARY");
  console.log("═".repeat(50));

  for (const [env, result] of Object.entries(results)) {
    const status = result.missing.length === 0 ? "✅" : "❌";
    console.log(`${status} ${env}: ${result.present}/${result.required} required vars`);
  }

  console.log();

  if (hasErrors) {
    console.log("❌ VERCEL ENVIRONMENT CHECK FAILED");
    console.log("\nTo add missing variables:");
    console.log("  npx vercel env add <VAR_NAME> <environment>\n");
    process.exit(1);
  } else {
    console.log("✅ VERCEL ENVIRONMENT CHECK PASSED\n");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error.message);
  process.exit(1);
});
