import { internalQuery } from "../_generated/server";

/**
 * Internal queries for subscription reconciliation.
 * Not exposed to clients - only callable from other Convex functions.
 */

/**
 * Get all users with subscription data for reconciliation.
 * Returns users who either:
 * - Have an active subscription status
 * - Have a stripeCustomerId (even if subscription inactive)
 */
export const getActiveSubscribers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all users with a stripeCustomerId
    const users = await ctx.db.query("users").collect();

    // Filter to users with subscription data
    return users
      .filter((u) => u.stripeCustomerId || u.subscriptionStatus)
      .map((u) => ({
        id: u._id,
        stripeCustomerId: u.stripeCustomerId,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionPlan: u.subscriptionPlan,
        subscriptionEndDate: u.subscriptionEndDate,
      }));
  },
});
