import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Subscription Mutations - Stripe Integration
 *
 * Mutations called by webhook handler.
 * Mutations update user subscription state based on Stripe events.
 *
 * Note: Using public mutations (not internal) to allow HTTP client calls from
 * Next.js API routes. Webhook signature verification happens in the API route.
 */

/**
 * Link Stripe customer to Convex user (called on first checkout)
 *
 * Uses clerkId to find user since stripeCustomerId doesn't exist yet.
 */
export const linkStripeCustomer = mutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { clerkId, stripeCustomerId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) {
      console.error(`[subscriptions] No user found for clerkId: ${clerkId}`);
      throw new Error(`No user found for clerkId: ${clerkId}`);
    }

    // Check if already linked (idempotent)
    if (user.stripeCustomerId === stripeCustomerId) {
      return user._id;
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId,
      updatedAt: Date.now(),
    });

    console.log(`[subscriptions] Linked Stripe customer ${stripeCustomerId} to user ${user._id}`);
    return user._id;
  },
});

/**
 * Update subscription status (called on subscription events)
 *
 * Handles: checkout.session.completed, customer.subscription.updated/deleted
 */
export const updateSubscription = mutation({
  args: {
    stripeCustomerId: v.string(),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.null(),
    ),
    subscriptionPlan: v.optional(v.union(v.literal("monthly"), v.literal("annual"), v.null())),
    subscriptionEndDate: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
      .first();

    if (!user) {
      console.error(`[subscriptions] No user for Stripe customer: ${args.stripeCustomerId}`);
      throw new Error(`No user found for Stripe customer: ${args.stripeCustomerId}`);
    }

    await ctx.db.patch(user._id, {
      subscriptionStatus: args.subscriptionStatus ?? undefined,
      subscriptionPlan: args.subscriptionPlan ?? undefined,
      subscriptionEndDate: args.subscriptionEndDate ?? undefined,
      updatedAt: Date.now(),
    });

    console.log(
      `[subscriptions] Updated user ${user._id}: status=${args.subscriptionStatus}, plan=${args.subscriptionPlan}`,
    );
    return user._id;
  },
});

/**
 * Clear subscription (called when subscription is fully canceled/deleted)
 */
export const clearSubscription = mutation({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { stripeCustomerId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first();

    if (!user) {
      console.error(`[subscriptions] No user for Stripe customer: ${stripeCustomerId}`);
      throw new Error(`No user found for Stripe customer: ${stripeCustomerId}`);
    }

    await ctx.db.patch(user._id, {
      subscriptionStatus: undefined,
      subscriptionPlan: undefined,
      subscriptionEndDate: undefined,
      updatedAt: Date.now(),
    });

    console.log(`[subscriptions] Cleared subscription for user ${user._id}`);
    return user._id;
  },
});

/**
 * Get subscription status for current user (client-callable)
 */
export const getSubscriptionStatus = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    return {
      stripeCustomerId: user.stripeCustomerId,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionEndDate: user.subscriptionEndDate,
      hasArchiveAccess:
        user.subscriptionStatus === "active" &&
        (!user.subscriptionEndDate || user.subscriptionEndDate > Date.now()),
    };
  },
});
