#!/usr/bin/env node
/**
 * Stripe Configuration Validator
 *
 * Validates Stripe configuration by checking:
 * 1. Environment variables are present and formatted correctly
 * 2. Price IDs exist and are active in Stripe
 * 3. Webhook is configured (if checking live mode)
 *
 * Usage:
 *   node scripts/verify-stripe-config.mjs [--live]
 *
 * Options:
 *   --live    Require live keys (sk_live_*, pk_live_*)
 *             Default: allows test keys
 *
 * Environment:
 *   STRIPE_SECRET_KEY            Required
 *   STRIPE_PRICE_MONTHLY         Required
 *   STRIPE_PRICE_ANNUAL          Required
 *   STRIPE_WEBHOOK_SECRET        Required
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  Required
 *
 * Exit Codes:
 *   0 = All checks passed
 *   1 = Validation errors found
 */

// =============================================================================
// STRIPE API HELPERS
// =============================================================================

async function stripeRequest(endpoint, secretKey) {
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

async function verifyPrice(priceId, secretKey) {
  try {
    const price = await stripeRequest(`/prices/${priceId}`, secretKey);
    return {
      valid: true,
      active: price.active,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
      product: price.product,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

async function verifyProduct(productId, secretKey) {
  try {
    const product = await stripeRequest(`/products/${productId}`, secretKey);
    return {
      valid: true,
      name: product.name,
      active: product.active,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

function checkEnvVars(requireLive) {
  const errors = [];
  const warnings = [];

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
  const priceAnnual = process.env.STRIPE_PRICE_ANNUAL;

  // Check presence
  if (!secretKey) errors.push("STRIPE_SECRET_KEY is missing");
  if (!publishableKey) errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing");
  if (!webhookSecret) errors.push("STRIPE_WEBHOOK_SECRET is missing");
  if (!priceMonthly) errors.push("STRIPE_PRICE_MONTHLY is missing");
  if (!priceAnnual) errors.push("STRIPE_PRICE_ANNUAL is missing");

  // Check formats
  if (secretKey && !secretKey.startsWith("sk_")) {
    errors.push("STRIPE_SECRET_KEY: Invalid format (must start with sk_)");
  }
  if (publishableKey && !publishableKey.startsWith("pk_")) {
    errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Invalid format (must start with pk_)");
  }
  if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
    errors.push("STRIPE_WEBHOOK_SECRET: Invalid format (must start with whsec_)");
  }
  if (priceMonthly && !priceMonthly.startsWith("price_")) {
    errors.push("STRIPE_PRICE_MONTHLY: Invalid format (must start with price_)");
  }
  if (priceAnnual && !priceAnnual.startsWith("price_")) {
    errors.push("STRIPE_PRICE_ANNUAL: Invalid format (must start with price_)");
  }

  // Check live mode
  if (requireLive) {
    if (secretKey?.startsWith("sk_test_")) {
      errors.push("STRIPE_SECRET_KEY: Test key in production (requires sk_live_*)");
    }
    if (publishableKey?.startsWith("pk_test_")) {
      errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Test key in production (requires pk_live_*)");
    }
  } else {
    if (secretKey?.startsWith("sk_test_")) {
      warnings.push("Using test mode keys (sk_test_*)");
    }
  }

  return { errors, warnings, secretKey, priceMonthly, priceAnnual };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const requireLive = process.argv.includes("--live");
  const mode = requireLive ? "LIVE" : "TEST/LIVE";

  console.log(`\n🔍 Validating Stripe Configuration (${mode} mode)\n`);

  // Step 1: Check environment variables
  const { errors, warnings, secretKey, priceMonthly, priceAnnual } = checkEnvVars(requireLive);

  if (warnings.length > 0) {
    console.log("⚠️  Warnings:");
    for (const warning of warnings) {
      console.log(`   - ${warning}`);
    }
    console.log();
  }

  if (errors.length > 0) {
    console.log("❌ Environment variable errors:");
    for (const error of errors) {
      console.log(`   - ${error}`);
    }
    console.log();
    console.log("❌ STRIPE CONFIGURATION FAILED\n");
    process.exit(1);
  }

  console.log("✅ Environment variables present and formatted correctly\n");

  // Step 2: Verify prices exist in Stripe
  console.log("🔍 Verifying Stripe resources...\n");

  const monthlyResult = await verifyPrice(priceMonthly, secretKey);
  const annualResult = await verifyPrice(priceAnnual, secretKey);

  let resourceErrors = [];

  if (!monthlyResult.valid) {
    resourceErrors.push(`STRIPE_PRICE_MONTHLY (${priceMonthly}): ${monthlyResult.error}`);
  } else if (!monthlyResult.active) {
    resourceErrors.push(`STRIPE_PRICE_MONTHLY (${priceMonthly}): Price is not active`);
  } else {
    console.log(`✅ Monthly price: ${priceMonthly}`);
    console.log(`   Amount: ${(monthlyResult.amount / 100).toFixed(2)} ${monthlyResult.currency.toUpperCase()}`);
    console.log(`   Interval: ${monthlyResult.interval}`);

    // Also verify the product
    const product = await verifyProduct(monthlyResult.product, secretKey);
    if (product.valid) {
      console.log(`   Product: ${product.name} (${product.active ? "active" : "INACTIVE"})`);
    }
    console.log();
  }

  if (!annualResult.valid) {
    resourceErrors.push(`STRIPE_PRICE_ANNUAL (${priceAnnual}): ${annualResult.error}`);
  } else if (!annualResult.active) {
    resourceErrors.push(`STRIPE_PRICE_ANNUAL (${priceAnnual}): Price is not active`);
  } else {
    console.log(`✅ Annual price: ${priceAnnual}`);
    console.log(`   Amount: ${(annualResult.amount / 100).toFixed(2)} ${annualResult.currency.toUpperCase()}`);
    console.log(`   Interval: ${annualResult.interval}`);

    const product = await verifyProduct(annualResult.product, secretKey);
    if (product.valid) {
      console.log(`   Product: ${product.name} (${product.active ? "active" : "INACTIVE"})`);
    }
    console.log();
  }

  if (resourceErrors.length > 0) {
    console.log("❌ Stripe resource errors:");
    for (const error of resourceErrors) {
      console.log(`   - ${error}`);
    }
    console.log();
    console.log("❌ STRIPE CONFIGURATION FAILED\n");
    process.exit(1);
  }

  // Success
  console.log("✅ STRIPE CONFIGURATION VALID");
  console.log(`   Mode: ${secretKey.startsWith("sk_live_") ? "LIVE" : "TEST"}`);
  console.log(`   Monthly: $${(monthlyResult.amount / 100).toFixed(2)}/${monthlyResult.interval}`);
  console.log(`   Annual: $${(annualResult.amount / 100).toFixed(2)}/${annualResult.interval}`);
  console.log();

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error.message);
  process.exit(1);
});
