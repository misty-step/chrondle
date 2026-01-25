import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Stripe Webhook Gateway - SINGLE public entry point for subscription updates
 *
 * Deep Module Design (Ousterhout):
 * - Simple interface: one action, one secret, typed payloads
 * - Complex implementation hidden: routing, validation, error handling
 * - Errors defined out of existence: internal mutations unreachable from browsers
 *
 * Security Model:
 * - Next.js route verifies Stripe signature (cryptographic proof)
 * - This action verifies shared secret (prevents direct calls)
 * - Internal mutations are physically uncallable from clients
 */

const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("canceled"),
  v.literal("past_due"),
  v.literal("trialing"),
  v.null(),
);

/**
 * Process a verified Stripe webhook event
 *
 * Called by Next.js API route AFTER Stripe signature verification.
 * Validates shared secret and routes to appropriate internal mutation.
 */
export const processWebhookEvent = action({
  args: {
    secret: v.string(),
    eventId: v.optional(v.string()),
    eventTimestamp: v.optional(v.number()),
    eventType: v.union(
      v.literal("checkout.session.completed"),
      v.literal("customer.subscription.updated"),
      v.literal("customer.subscription.deleted"),
      v.literal("invoice.payment_failed"),
    ),
    payload: v.object({
      // For checkout.session.completed - links customer and activates
      clerkId: v.optional(v.string()),
      stripeCustomerId: v.string(),
      // For subscription events
      subscriptionStatus: v.optional(subscriptionStatusValidator),
      subscriptionPlan: v.optional(v.union(v.literal("monthly"), v.literal("annual"), v.null())),
      subscriptionEndDate: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, { secret, eventId, eventTimestamp, eventType, payload }) => {
    // Validate shared secret - single point of authorization
    const expectedSecret = process.env.STRIPE_SYNC_SECRET;
    if (!expectedSecret) {
      throw new Error("STRIPE_SYNC_SECRET not configured in Convex environment");
    }
    if (secret !== expectedSecret) {
      console.error("[stripe-webhook-action] Invalid secret provided");
      throw new Error("Unauthorized: invalid webhook secret");
    }

    // Route to appropriate internal mutation based on event type
    switch (eventType) {
      case "checkout.session.completed": {
        if (!payload.clerkId) {
          throw new Error("checkout.session.completed requires clerkId");
        }
        // Link Stripe customer to user
        await ctx.runMutation(internal.users.subscriptions.linkStripeCustomer, {
          clerkId: payload.clerkId,
          stripeCustomerId: payload.stripeCustomerId,
        });
        // Activate subscription if status provided
        if (payload.subscriptionStatus) {
          await ctx.runMutation(internal.users.subscriptions.updateSubscription, {
            stripeCustomerId: payload.stripeCustomerId,
            subscriptionStatus: payload.subscriptionStatus,
            subscriptionPlan: payload.subscriptionPlan,
            subscriptionEndDate: payload.subscriptionEndDate,
            eventId,
            eventTimestamp,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        if (!payload.subscriptionStatus) {
          throw new Error("customer.subscription.updated requires subscriptionStatus");
        }
        await ctx.runMutation(internal.users.subscriptions.updateSubscription, {
          stripeCustomerId: payload.stripeCustomerId,
          subscriptionStatus: payload.subscriptionStatus,
          subscriptionPlan: payload.subscriptionPlan,
          subscriptionEndDate: payload.subscriptionEndDate,
          eventId,
          eventTimestamp,
        });
        break;
      }

      case "customer.subscription.deleted": {
        await ctx.runMutation(internal.users.subscriptions.clearSubscription, {
          stripeCustomerId: payload.stripeCustomerId,
        });
        break;
      }

      case "invoice.payment_failed": {
        await ctx.runMutation(internal.users.subscriptions.updateSubscription, {
          stripeCustomerId: payload.stripeCustomerId,
          subscriptionStatus: "past_due",
          eventId,
          eventTimestamp,
        });
        break;
      }
    }

    console.log(
      `[stripe-webhook-action] Processed ${eventType} for customer ${payload.stripeCustomerId}`,
    );
  },
});
