#!/usr/bin/env node
/**
 * Environment Configuration Validator
 *
 * Validates environment variables against expected formats and requirements.
 * Used in CI quality gates and pre-deploy checks.
 *
 * Usage:
 *   node scripts/verify-env-config.mjs [environment]
 *
 * Environments:
 *   - development (default): Core vars only
 *   - preview: Core + Stripe (test keys allowed)
 *   - production: Core + Stripe (live keys required)
 *   - ci: Core vars, development-only Convex, no deployment credential
 *
 * Exit Codes:
 *   0 = All checks passed
 *   1 = Validation errors found
 */

import { verifyCiBackend } from "./verify-ci-backend.mjs";
import { getRequiredVars, validateEnvironment } from "../src/lib/env.schema.ts";

// =============================================================================
// Validation has one home: src/lib/env.schema.ts. Never print runtime values.
// =============================================================================

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const env = process.argv[2] || "development";
  const validEnvs = ["development", "preview", "production", "ci"];

  if (!validEnvs.includes(env)) {
    console.error(`\n❌ Invalid environment: ${env}`);
    console.error(`   Valid options: ${validEnvs.join(", ")}\n`);
    process.exit(1);
  }

  console.log(`\n🔍 Validating environment: ${env.toUpperCase()}\n`);

  // CI intentionally has no deployment credential; keep its existing public
  // requirements and enforce development isolation separately below.
  const schemaEnvironment = env === "ci" ? "development" : env;
  const required = getRequiredVars(schemaEnvironment);
  const { missing, invalid } = validateEnvironment(schemaEnvironment, process.env, {
    checkLiveMode: true,
  });
  const valid = required.filter(
    (key) => !missing.includes(key) && !invalid.some((item) => item.key === key),
  );

  if (env === "ci") {
    try {
      verifyCiBackend();
    } catch (error) {
      invalid.push({ key: "CI Convex isolation", error: error.message });
    }
  }

  // Report results
  if (valid.length > 0) {
    console.log("✅ Valid variables:");
    for (const key of valid) {
      console.log(`   ${key}`);
    }
    console.log();
  }

  if (missing.length > 0) {
    console.log("❌ Missing required variables:");
    for (const key of missing) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  if (invalid.length > 0) {
    console.log("❌ Invalid format:");
    for (const { key, error } of invalid) {
      console.log(`   - ${key}: ${error}`);
    }
    console.log();
  }

  // Summary
  const total = required.length;
  const passed = valid.length;
  const failed = missing.length + invalid.length;

  if (failed === 0) {
    console.log(`✅ All ${total} required variables validated successfully!\n`);
    process.exit(0);
  } else {
    console.log(`❌ ENVIRONMENT CONFIGURATION ERROR`);
    console.log(`   ${passed}/${total} passed, ${failed} failed\n`);
    console.log("   Fix the issues above and re-run validation.\n");
    process.exit(1);
  }
}

main();
