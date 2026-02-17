import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { checkArchiveAccess } from "./helpers";

/**
 * Subscription Mutations - Stripe Integration (INTERNAL)
 *
 * These are internalMutation - NOT callable from browsers or external clients.
 * Only callable from other Convex functions (actions, mutations).
 *
 * External access goes through the processWebhookEvent action in
 * convex/stripe/webhookAction.ts which validates the shared secret.
 *
 * This architecture follows Ousterhout's "define errors out of existence":
 * by making mutations internal, unauthorized access is physically impossible.
 */

/**
 * Link Stripe customer to Convex user (called on first checkout)
 *
 * Uses clerkId to find user since stripeCustomerId doesn't exist yet.
 */
export const linkStripeCustomer = internalMutation({
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
export const updateSubscription = internalMutation({
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
    eventId: v.optional(v.string()),
    eventTimestamp: v.optional(v.number()),
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

    // Idempotency check - skip duplicate events
    if (args.eventId && user.lastStripeEventId === args.eventId) {
      console.log(`[subscriptions] Skipping duplicate event ${args.eventId} for user ${user._id}`);
      return user._id;
    }

    // Out-of-order check - skip stale events
    if (
      args.eventTimestamp !== undefined &&
      user.lastStripeEventTimestamp !== undefined &&
      args.eventTimestamp < user.lastStripeEventTimestamp
    ) {
      console.log(
        `[subscriptions] Skipping stale event (${args.eventTimestamp} < ${user.lastStripeEventTimestamp}) for user ${user._id}`,
      );
      return user._id;
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
      trialEndsAt?: undefined;
      lastStripeEventId?: string;
      lastStripeEventTimestamp?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    // subscriptionStatus is required in args, always update
    patch.subscriptionStatus = args.subscriptionStatus;

    // Clear zombie trial when subscription activates
    // Without this, canceled users could regain access via stale trial data
    if (args.subscriptionStatus === "active" && user.trialEndsAt) {
      patch.trialEndsAt = undefined;
    }

    // Optional fields: only include if explicitly provided
    // Convert null to undefined (Convex doesn't store null for optional numbers)
    if (args.subscriptionPlan !== undefined) {
      patch.subscriptionPlan = args.subscriptionPlan;
    }
    if (args.subscriptionEndDate !== undefined) {
      patch.subscriptionEndDate = args.subscriptionEndDate ?? undefined;
    }
    if (args.eventId !== undefined) {
      patch.lastStripeEventId = args.eventId;
    }
    if (args.eventTimestamp !== undefined) {
      patch.lastStripeEventTimestamp = args.eventTimestamp;
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
export const clearSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    eventId: v.optional(v.string()),
    eventTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, { stripeCustomerId, eventId, eventTimestamp }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first();

    if (!user) {
      console.error(`[subscriptions] No user for Stripe customer: ${stripeCustomerId}`);
      throw new Error(`No user found for Stripe customer: ${stripeCustomerId}`);
    }

    // Idempotency check - skip duplicate events
    if (eventId && user.lastStripeEventId === eventId) {
      console.log(`[subscriptions] Skipping duplicate event ${eventId} for user ${user._id}`);
      return user._id;
    }

    // Out-of-order check - skip stale events
    if (
      eventTimestamp !== undefined &&
      user.lastStripeEventTimestamp !== undefined &&
      eventTimestamp < user.lastStripeEventTimestamp
    ) {
      console.log(
        `[subscriptions] Skipping stale event (${eventTimestamp} < ${user.lastStripeEventTimestamp}) for user ${user._id}`,
      );
      return user._id;
    }

    // Build patch with idempotency tracking
    const patch: {
      subscriptionStatus?: undefined;
      subscriptionPlan?: undefined;
      subscriptionEndDate?: undefined;
      lastStripeEventId?: string;
      lastStripeEventTimestamp?: number;
      updatedAt: number;
    } = {
      subscriptionStatus: undefined,
      subscriptionPlan: undefined,
      subscriptionEndDate: undefined,
      updatedAt: Date.now(),
    };

    if (eventId !== undefined) {
      patch.lastStripeEventId = eventId;
    }
    if (eventTimestamp !== undefined) {
      patch.lastStripeEventTimestamp = eventTimestamp;
    }

    await ctx.db.patch(user._id, patch);

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
      // Note: stripeCustomerId intentionally NOT exposed to prevent subscription tampering
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionEndDate: user.subscriptionEndDate,
      hasArchiveAccess: checkArchiveAccess(user),
    };
  },
});
