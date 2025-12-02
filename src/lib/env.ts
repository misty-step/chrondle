// Environment Variable Validation and Error Handling
// Provides graceful error handling for missing environment variables
// to prevent 500 errors and improve developer experience

import { logger } from "./logger";

/**
 * Environment validation result
 */
interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

/**
 * Validates all required environment variables (client and server)
 * @returns Validation result with missing variables
 *
 * Note: This function validates NEXT_PUBLIC_* vars which are client-side only.
 * On server (SSG/build), these vars may not be available and validation is
 * meaningless - skip entirely. The deep module owns its execution context.
 */
export function validateEnvironment(): EnvValidationResult {
  // Server-side: skip validation. NEXT_PUBLIC_* vars are client-side only,
  // embedded in the JS bundle at build time. Validation only makes sense
  // in browser where we can show error UI to users.
  if (typeof window === "undefined") {
    return { isValid: true, missingVars: [], warnings: [] };
  }

  const result: EnvValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  // Check required client-side variables
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    result.missingVars.push("NEXT_PUBLIC_CONVEX_URL");
    result.isValid = false;
  }

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    result.missingVars.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    result.isValid = false;
  }

  // Check optional but recommended variables
  if (!process.env.OPENROUTER_API_KEY) {
    result.warnings.push("OPENROUTER_API_KEY is not set - AI features will be disabled");
  }

  // Log validation results
  if (!result.isValid) {
    logger.error("Missing required environment variables", {
      missing: result.missingVars,
    });
  }

  if (result.warnings.length > 0) {
    logger.warn("Environment warnings", {
      warnings: result.warnings,
    });
  }

  return result;
}

/**
 * Validates required server-side environment variables
 * @throws Error if required environment variables are missing
 */
export function validateServerEnvironment(): void {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for AI historical context generation");
  }
}

/**
 * Gets OpenRouter API key from environment
 * @returns API key string
 * @throws Error if API key is not configured
 */
export function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return apiKey;
}

/**
 * Safe environment variable getter with fallback
 * @param key Environment variable key
 * @param fallback Fallback value if not set
 * @returns Environment variable value or fallback
 */
export function getEnvVar(key: string, fallback: string = ""): string {
  try {
    return process.env[key] || fallback;
  } catch (error) {
    logger.warn(`Failed to access environment variable: ${key}`, error);
    return fallback;
  }
}

/**
 * Checks if we're running in a CI environment
 * @returns true if running in CI
 */
export function isCI(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.VERCEL === "1" ||
    false
  );
}

/**
 * Checks if we're running in production
 * @returns true if in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Gets a descriptive error message for missing environment variables
 * @param missingVars Array of missing variable names
 * @returns User-friendly error message
 */
export function getEnvErrorMessage(missingVars: string[]): string {
  if (isProduction()) {
    return "The application is not properly configured. Please contact support.";
  }

  if (isCI()) {
    return `CI Environment Error: Missing required environment variables: ${missingVars.join(", ")}. 
            Please ensure these are set in your CI workflow configuration.`;
  }

  return `Missing required environment variables: ${missingVars.join(", ")}. 
          Please check your .env.local file and ensure all required variables are set.
          See .env.example for the required configuration.`;
}
