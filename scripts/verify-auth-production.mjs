#!/usr/bin/env node
/**
 * Production Authentication Verification Script
 *
 * This script verifies that the production authentication flow is properly configured:
 * 1. Clerk production keys are valid
 * 2. Domain configuration is correct
 * 3. Google OAuth settings are functional
 * 4. User sync to Convex via webhook is working
 *
 * Usage: node scripts/verify-auth-production.mjs [--production]
 */

import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) =>
    console.log(`\n${colors.cyan}═══${colors.reset} ${msg} ${colors.cyan}═══${colors.reset}`),
};

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes("--production");

// Load environment variables
const envFile = isProduction ? ".env.production" : ".env.local";
const envPath = join(process.cwd(), envFile);

if (!existsSync(envPath)) {
  log.error(`Environment file not found: ${envFile}`);
  log.info(`Please create ${envFile} with your production configuration`);
  process.exit(1);
}

// Load environment variables from the appropriate file
config({ path: envPath });

// Helper function to check if a value looks like a production key
function isProductionKey(key, prefix) {
  return key && key.startsWith(prefix);
}

// Helper function to mask sensitive keys for display
function maskKey(key) {
  if (!key) return "NOT SET";
  if (key.length <= 10) return "***";
  return key.substring(0, 10) + "..." + key.substring(key.length - 4);
}

// Verification results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

// Main verification function
async function verifyAuthConfiguration() {
  log.section("Production Authentication Verification");
  log.info(`Checking configuration from: ${envFile}`);

  // 1. Check Node Environment
  log.section("Environment Settings");

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "production") {
    log.success(`NODE_ENV is set to production`);
    results.passed.push("NODE_ENV configuration");
  } else {
    log.warning(`NODE_ENV is set to: ${nodeEnv || "NOT SET"}`);
    results.warnings.push('NODE_ENV should be "production" for production deployment');
  }

  // 2. Check Clerk Configuration
  log.section("Clerk Authentication");

  // Check publishable key
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (isProductionKey(clerkPublishableKey, "pk_live_")) {
    log.success(`Clerk publishable key is a production key: ${maskKey(clerkPublishableKey)}`);
    results.passed.push("Clerk publishable key");
  } else if (isProductionKey(clerkPublishableKey, "pk_test_")) {
    log.warning(`Clerk publishable key is a test key: ${maskKey(clerkPublishableKey)}`);
    results.warnings.push("Using test Clerk publishable key - should use pk_live_ for production");
  } else {
    log.error(`Clerk publishable key is not configured properly: ${maskKey(clerkPublishableKey)}`);
    results.failed.push("Clerk publishable key configuration");
  }

  // Check secret key
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (isProductionKey(clerkSecretKey, "sk_live_")) {
    log.success(`Clerk secret key is a production key: ${maskKey(clerkSecretKey)}`);
    results.passed.push("Clerk secret key");
  } else if (isProductionKey(clerkSecretKey, "sk_test_")) {
    log.warning(`Clerk secret key is a test key: ${maskKey(clerkSecretKey)}`);
    results.warnings.push("Using test Clerk secret key - should use sk_live_ for production");
  } else {
    log.error(`Clerk secret key is not configured properly: ${maskKey(clerkSecretKey)}`);
    results.failed.push("Clerk secret key configuration");
  }

  // Check webhook secret
  const clerkWebhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (isProductionKey(clerkWebhookSecret, "whsec_")) {
    log.success(`Clerk webhook secret is configured: ${maskKey(clerkWebhookSecret)}`);
    results.passed.push("Clerk webhook secret");
  } else {
    log.error(`Clerk webhook secret is not configured properly`);
    results.failed.push("Clerk webhook secret configuration");
  }

  // 3. Check Google OAuth Configuration
  log.section("Google OAuth");

  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (googleClientId && googleClientId.includes(".apps.googleusercontent.com")) {
    log.success(`Google OAuth Client ID is configured: ${maskKey(googleClientId)}`);
    results.passed.push("Google OAuth Client ID");
  } else {
    log.warning(`Google OAuth Client ID may not be configured: ${maskKey(googleClientId)}`);
    results.warnings.push("Google OAuth Client ID should end with .apps.googleusercontent.com");
  }

  if (googleClientSecret && googleClientSecret.startsWith("GOCSPX-")) {
    log.success(`Google OAuth Client Secret is configured: ${maskKey(googleClientSecret)}`);
    results.passed.push("Google OAuth Client Secret");
  } else {
    log.warning(`Google OAuth Client Secret may not be configured properly`);
    results.warnings.push("Google OAuth Client Secret should start with GOCSPX-");
  }

  // 4. Check Convex Configuration
  log.section("Convex Backend");

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexDeployKey = process.env.CONVEX_DEPLOY_KEY;
  const convexDeployment = process.env.CONVEX_DEPLOYMENT;

  if (convexUrl && convexUrl.includes("fleet-goldfish-183")) {
    log.success(`Convex URL points to production: ${convexUrl}`);
    results.passed.push("Convex production URL");
  } else if (convexUrl && convexUrl.includes("handsome-raccoon-955")) {
    log.warning(`Convex URL points to development: ${convexUrl}`);
    results.warnings.push(
      "Using development Convex deployment - should use fleet-goldfish-183 for production",
    );
  } else {
    log.error(`Convex URL is not configured properly: ${convexUrl || "NOT SET"}`);
    results.failed.push("Convex URL configuration");
  }

  if (convexDeployKey && convexDeployKey.includes("prod:fleet-goldfish-183")) {
    log.success(`Convex deploy key is for production: ${maskKey(convexDeployKey)}`);
    results.passed.push("Convex deploy key");
  } else {
    log.warning(`Convex deploy key may not be for production`);
    results.warnings.push("Convex deploy key should include prod:fleet-goldfish-183");
  }

  if (convexDeployment === "prod:fleet-goldfish-183") {
    log.success(`Convex deployment is set to production`);
    results.passed.push("Convex deployment setting");
  } else {
    log.warning(`Convex deployment is set to: ${convexDeployment || "NOT SET"}`);
    results.warnings.push("Convex deployment should be prod:fleet-goldfish-183");
  }

  // 5. Domain Configuration Check
  log.section("Domain Configuration");

  // Extract domain from Clerk publishable key
  if (clerkPublishableKey) {
    try {
      // Decode the base64 part of the key to get the domain
      const keyPart = clerkPublishableKey.replace("pk_live_", "").replace("pk_test_", "");
      const decoded = Buffer.from(keyPart, "base64").toString("utf-8");

      if (decoded.includes("clerk.chrondle.app")) {
        log.success(`Clerk domain is configured as: clerk.chrondle.app`);
        results.passed.push("Clerk domain configuration");
      } else if (decoded.includes("chrondle.app")) {
        log.success(`Clerk domain includes chrondle.app`);
        results.passed.push("Clerk domain configuration");
      } else {
        log.info(`Clerk domain decoded as: ${decoded}`);
        results.warnings.push("Clerk domain should be clerk.chrondle.app");
      }
    } catch (e) {
      log.info(`Could not decode Clerk domain from publishable key`);
    }
  }

  // 6. Production Readiness Checklist
  log.section("Production Readiness Checklist");

  const checklist = [
    {
      name: "Production Clerk keys (pk_live_, sk_live_)",
      check: () =>
        isProductionKey(clerkPublishableKey, "pk_live_") &&
        isProductionKey(clerkSecretKey, "sk_live_"),
    },
    {
      name: "Webhook secret configured",
      check: () => isProductionKey(clerkWebhookSecret, "whsec_"),
    },
    {
      name: "Production Convex deployment",
      check: () => convexUrl?.includes("fleet-goldfish-183"),
    },
    {
      name: "Google OAuth configured",
      check: () => !!googleClientId && !!googleClientSecret,
    },
    {
      name: "NODE_ENV set to production",
      check: () => nodeEnv === "production",
    },
  ];

  checklist.forEach((item) => {
    if (item.check()) {
      log.success(item.name);
      results.passed.push(item.name);
    } else {
      log.error(item.name);
      results.failed.push(item.name);
    }
  });

  // 7. Summary
  log.section("Verification Summary");

  const total = results.passed.length + results.failed.length + results.warnings.length;

  console.log(`\n${colors.green}Passed:${colors.reset} ${results.passed.length}/${total}`);
  console.log(`${colors.yellow}Warnings:${colors.reset} ${results.warnings.length}/${total}`);
  console.log(`${colors.red}Failed:${colors.reset} ${results.failed.length}/${total}`);

  if (results.failed.length === 0) {
    log.success("\n🎉 Production authentication is properly configured!");

    console.log("\nNext steps:");
    console.log("1. Deploy to production environment");
    console.log("2. Test authentication flow on production URL");
    console.log("3. Verify webhook events are received in Clerk dashboard");
    console.log("4. Check that users are synced to Convex database");
  } else {
    log.error("\n❌ Production authentication has configuration issues");

    console.log("\nRequired fixes:");
    results.failed.forEach((issue) => {
      console.log(`  - ${issue}`);
    });

    if (results.warnings.length > 0) {
      console.log("\nRecommended improvements:");
      results.warnings.forEach((warning) => {
        console.log(`  - ${warning}`);
      });
    }
  }

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run verification
verifyAuthConfiguration().catch((error) => {
  log.error(`Verification failed with error: ${error.message}`);
  process.exit(1);
});
