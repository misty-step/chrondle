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
 *   - ci: Core + deploy key
 *
 * Exit Codes:
 *   0 = All checks passed
 *   1 = Validation errors found
 */

// =============================================================================
// CONFIGURATION (mirrors src/lib/env.schema.ts)
// =============================================================================

const PATTERNS = {
  NEXT_PUBLIC_CONVEX_URL: {
    pattern: /^https:\/\/.*\.convex\.cloud/,
    description: "Must be a valid Convex URL (https://*.convex.cloud)",
  },
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: {
    pattern: /^pk_/,
    description: "Must start with pk_",
  },
  CLERK_SECRET_KEY: {
    pattern: /^sk_/,
    description: "Must start with sk_",
  },
  STRIPE_SECRET_KEY: {
    pattern: /^sk_(test|live)_/,
    description: "Must start with sk_test_ or sk_live_",
  },
  STRIPE_WEBHOOK_SECRET: {
    pattern: /^whsec_/,
    description: "Must start with whsec_",
  },
  STRIPE_SYNC_SECRET: {
    minLength: 20,
    description: "Must be at least 20 characters",
  },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
    pattern: /^pk_(test|live)_/,
    description: "Must start with pk_test_ or pk_live_",
  },
  STRIPE_PRICE_MONTHLY: {
    pattern: /^price_/,
    description: "Must start with price_",
  },
  STRIPE_PRICE_ANNUAL: {
    pattern: /^price_/,
    description: "Must start with price_",
  },
  CONVEX_DEPLOY_KEY: {
    pattern: /^(prod|dev):/,
    description: "Must start with prod: or dev:",
  },
};

const REQUIRED_VARS = {
  all: [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ],
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
  ci: ["CONVEX_DEPLOY_KEY"],
};

// =============================================================================
// VALIDATION LOGIC
// =============================================================================

function getRequiredVars(env) {
  const base = [...REQUIRED_VARS.all];
  switch (env) {
    case "production":
      return [...base, ...REQUIRED_VARS.production];
    case "preview":
      return [...base, ...REQUIRED_VARS.preview];
    case "ci":
      return [...base, ...REQUIRED_VARS.ci];
    default:
      return base;
  }
}

function validateVar(key, value) {
  const config = PATTERNS[key];
  if (!config) return { valid: true };

  if (!value) {
    return { valid: false, error: "Missing or empty" };
  }

  if (config.pattern && !config.pattern.test(value)) {
    return { valid: false, error: config.description };
  }

  if (config.minLength && value.length < config.minLength) {
    return { valid: false, error: config.description };
  }

  return { valid: true };
}

function checkLiveMode(env, vars) {
  if (env !== "production") return [];

  const errors = [];

  const stripeSecret = vars["STRIPE_SECRET_KEY"];
  if (stripeSecret?.startsWith("sk_test_")) {
    errors.push({
      key: "STRIPE_SECRET_KEY",
      error: "Test key (sk_test_*) in production - requires live key (sk_live_*)",
    });
  }

  const stripePk = vars["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
  if (stripePk?.startsWith("pk_test_")) {
    errors.push({
      key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      error: "Test key (pk_test_*) in production - requires live key (pk_live_*)",
    });
  }

  return errors;
}

function maskValue(value) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "***";
  return value.slice(0, 4) + "***" + value.slice(-4);
}

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

  const required = getRequiredVars(env);
  const missing = [];
  const invalid = [];
  const valid = [];

  // Check each required variable
  for (const key of required) {
    const value = process.env[key];

    if (!value) {
      missing.push(key);
      continue;
    }

    const result = validateVar(key, value);
    if (!result.valid) {
      invalid.push({ key, error: result.error, value: maskValue(value) });
    } else {
      valid.push({ key, value: maskValue(value) });
    }
  }

  // Check live mode for production
  const liveModeErrors = checkLiveMode(env, process.env);
  invalid.push(...liveModeErrors);

  // Report results
  if (valid.length > 0) {
    console.log("✅ Valid variables:");
    for (const { key, value } of valid) {
      console.log(`   ${key}: ${value}`);
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
    for (const { key, error, value } of invalid) {
      console.log(`   - ${key}: ${error}`);
      if (value) console.log(`     Current value: ${value}`);
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
