/**
 * Centralized Environment Variable Schema
 *
 * Single source of truth for env var validation across:
 * - CI quality gates
 * - Pre-deploy verification
 * - Runtime validation (optional)
 */
import { z } from "zod";

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const envSchemas = {
  // Core Infrastructure
  NEXT_PUBLIC_CONVEX_URL: z.string().url().includes("convex.cloud"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  CLERK_SECRET_KEY: z.string().startsWith("sk_"),

  // Stripe Keys
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/, "Must start with sk_test_ or sk_live_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_SYNC_SECRET: z.string().min(20, "Must be at least 20 characters"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^pk_(test|live)_/, "Must start with pk_test_ or pk_live_"),

  // Stripe Resources
  STRIPE_PRICE_MONTHLY: z.string().startsWith("price_"),
  STRIPE_PRICE_ANNUAL: z.string().startsWith("price_"),

  // Convex
  CONVEX_DEPLOY_KEY: z.string().regex(/^prod:|dev:/, "Must start with prod: or dev:"),

  // Optional: Observability
  OPENROUTER_API_KEY: z.string().startsWith("sk-or-").optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
} as const;

// =============================================================================
// ENVIRONMENT REQUIREMENTS
// =============================================================================

export const REQUIRED_VARS = {
  // All environments need these
  all: ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"] as const,

  // Production and Preview need Stripe
  production: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SYNC_SECRET",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_ANNUAL",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ] as const,

  // Preview inherits production requirements
  preview: [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_SYNC_SECRET",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_ANNUAL",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  ] as const,

  // CI needs deploy key
  ci: ["CONVEX_DEPLOY_KEY"] as const,

  // Convex backend needs sync secret
  convex: ["STRIPE_SYNC_SECRET"] as const,
} as const;

// =============================================================================
// LIVE MODE VALIDATION
// =============================================================================

/**
 * Validates that production uses live keys, not test keys.
 * Returns errors if test keys are found in production.
 */
export function validateLiveMode(vars: Record<string, string | undefined>): string[] {
  const errors: string[] = [];

  const stripeSecret = vars["STRIPE_SECRET_KEY"];
  if (stripeSecret?.startsWith("sk_test_")) {
    errors.push(
      "STRIPE_SECRET_KEY: Found test key (sk_test_*) - production requires live key (sk_live_*)",
    );
  }

  const stripePk = vars["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
  if (stripePk?.startsWith("pk_test_")) {
    errors.push(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Found test key (pk_test_*) - production requires live key (pk_live_*)",
    );
  }

  return errors;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

export type EnvKey = keyof typeof envSchemas;
export type Environment = "development" | "preview" | "production" | "ci" | "convex";

/**
 * Get required variables for an environment
 */
export function getRequiredVars(env: Environment): readonly string[] {
  const base = [...REQUIRED_VARS.all];

  switch (env) {
    case "production":
      return [...base, ...REQUIRED_VARS.production];
    case "preview":
      return [...base, ...REQUIRED_VARS.preview];
    case "ci":
      return [...base, ...REQUIRED_VARS.ci];
    case "convex":
      return [...REQUIRED_VARS.convex];
    case "development":
    default:
      return base;
  }
}

/**
 * Validate a single environment variable
 */
export function validateVar(
  key: string,
  value: string | undefined,
): { valid: boolean; error?: string } {
  const schema = envSchemas[key as EnvKey];

  if (!schema) {
    return { valid: true }; // Unknown vars pass through
  }

  if (value === undefined || value === "") {
    return { valid: false, error: "Value is missing or empty" };
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    return { valid: false, error: result.error.issues[0]?.message || "Invalid format" };
  }

  return { valid: true };
}

/**
 * Validate all required variables for an environment
 */
export function validateEnvironment(
  env: Environment,
  vars: Record<string, string | undefined>,
  options: { checkLiveMode?: boolean } = {},
): { valid: boolean; missing: string[]; invalid: Array<{ key: string; error: string }> } {
  const required = getRequiredVars(env);
  const missing: string[] = [];
  const invalid: Array<{ key: string; error: string }> = [];

  for (const key of required) {
    const value = vars[key];

    if (value === undefined || value === "") {
      missing.push(key);
      continue;
    }

    const result = validateVar(key, value);
    if (!result.valid && result.error) {
      invalid.push({ key, error: result.error });
    }
  }

  // Check live mode for production
  if (options.checkLiveMode && env === "production") {
    const liveModeErrors = validateLiveMode(vars);
    for (const error of liveModeErrors) {
      const [key] = error.split(":");
      invalid.push({ key: key.trim(), error: error.split(":").slice(1).join(":").trim() });
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}
