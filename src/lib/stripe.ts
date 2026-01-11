import Stripe from "stripe";

/**
 * Server-side Stripe client singleton
 *
 * Usage: Import in API routes and server components only.
 * For client-side, use @stripe/stripe-js with NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

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
 * Check if a user has active archive access based on subscription status
 */
export function hasActiveSubscription(
  subscriptionStatus: string | undefined | null,
  subscriptionEndDate: number | undefined | null,
): boolean {
  if (subscriptionStatus !== "active") return false;
  if (subscriptionEndDate && subscriptionEndDate < Date.now()) return false;
  return true;
}
