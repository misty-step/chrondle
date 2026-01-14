import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Get the Stripe client singleton.
 * Lazy-initialized to allow builds without STRIPE_SECRET_KEY.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured. Add it to your environment variables.");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
}

export type PricePlan = "monthly" | "annual";

/**
 * Get validated price ID from environment.
 * Throws if price ID is not configured (fail fast on misconfiguration).
 */
export function getPriceId(plan: PricePlan): string {
  const envKey = plan === "monthly" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_ANNUAL";
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(`${envKey} is not configured. Add it to your environment variables.`);
  }
  return priceId;
}

/**
 * Get the app origin from request headers.
 * Falls back to NEXT_PUBLIC_APP_URL or localhost.
 */
export function getAppOrigin(req: Request): string {
  return req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
