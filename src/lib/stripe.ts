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

/**
 * Price IDs from Stripe Dashboard
 * Set these in environment variables after creating products/prices in Stripe.
 */
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!, // $0.99/month
  annual: process.env.STRIPE_PRICE_ANNUAL!, // $9.99/year
} as const;

export type PricePlan = keyof typeof PRICES;

/**
 * Get the app origin from request headers.
 * Falls back to NEXT_PUBLIC_APP_URL or localhost.
 */
export function getAppOrigin(req: Request): string {
  return req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
