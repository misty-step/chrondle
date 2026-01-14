import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * Subscription Mutations - Stripe Integration
 *
 * Mutations called by webhook handler.
 * Mutations update user subscription state based on Stripe events.
 *
 * SECURITY NOTE: These mutations are public (not internalMutation) to allow
 * HTTP client calls from Next.js API routes where Stripe webhook signature
 * verification occurs. While technically callable from any Convex client,
 * the attack surface is limited:
 * - stripeCustomerId is only set via linkStripeCustomer (requires valid clerkId)
 * - An attacker would need to know a user's stripeCustomerId to tamper
 *
 * FUTURE: Consider moving to httpAction with signature verification in Convex,
 * or adding a shared secret parameter validated server-side.
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

    // Build patch object, properly handling null vs undefined:
    // - null: explicitly clear the field (convert to undefined for Convex)
    // - undefined: don't update the field
    type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing" | null;
    type SubscriptionPlan = "monthly" | "annual" | null;

    const patch: {
      subscriptionStatus?: SubscriptionStatus;
      subscriptionPlan?: SubscriptionPlan;
      subscriptionEndDate?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    // subscriptionStatus is required in args, always update
    patch.subscriptionStatus = args.subscriptionStatus;

    // Optional fields: only include if explicitly provided
    // Convert null to undefined (Convex doesn't store null for optional numbers)
    if (args.subscriptionPlan !== undefined) {
      patch.subscriptionPlan = args.subscriptionPlan;
    }
    if (args.subscriptionEndDate !== undefined) {
      patch.subscriptionEndDate = args.subscriptionEndDate ?? undefined;
    }

    await ctx.db.patch(user._id, patch);

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
export const getSubscriptionStatus = query({
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
