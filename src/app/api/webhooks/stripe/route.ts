import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api, requireConvexClient } from "@/lib/convexServer";
import { getStripe } from "@/lib/stripe";
import { getEnvVar } from "@/lib/env";
import { logger } from "@/lib/logger";

type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing" | null;

/** Map Stripe status to our simplified status */
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "canceled",
  trialing: "trialing",
};

/**
 * Extract customer ID from Stripe object (string | Customer | DeletedCustomer | null)
 */
function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (typeof customer === "string") return customer;
  if (customer && "id" in customer) return customer.id;
  return null;
}

/**
 * Extract subscription ID from Stripe object (string | Subscription | null)
 */
function extractSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined,
): string | null {
  if (typeof subscription === "string") return subscription;
  if (subscription && "id" in subscription) return subscription.id;
  return null;
}

/**
 * Extract period end from subscription items (throws if missing)
 *
 * Note: In the Stripe API version used by this project, current_period_end
 * is on SubscriptionItem, not the top-level Subscription object.
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number {
  const firstItem = subscription.items?.data?.[0];
  if (!firstItem?.current_period_end) {
    throw new Error(`Subscription ${subscription.id} missing current_period_end`);
  }
  return firstItem.current_period_end;
}

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler. Verifies signature then delegates to Convex action.
 *
 * Security Model:
 * 1. Stripe signature verification (cryptographic proof from Stripe)
 * 2. Shared secret validation (in Convex action)
 * 3. Internal mutations (physically unreachable from browsers)
 */
export async function POST(req: NextRequest) {
  let convexClient: ConvexHttpClient;
  try {
    convexClient = requireConvexClient();
  } catch {
    logger.error("[stripe-webhook] NEXT_PUBLIC_CONVEX_URL not configured");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Get shared secret for Convex action
  const syncSecret = getEnvVar("STRIPE_SYNC_SECRET");
  if (!syncSecret) {
    logger.error("[stripe-webhook] STRIPE_SYNC_SECRET not configured");
    return NextResponse.json({ error: "Sync secret not configured" }, { status: 500 });
  }

  // Get raw body for signature verification
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    logger.warn("[stripe-webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = getEnvVar("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logger.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Verify Stripe signature
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(`[stripe-webhook] Signature verification failed: ${message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

  try {
    // Process event and call Convex action
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.client_reference_id;
        const stripeCustomerId = extractCustomerId(session.customer);

        if (!clerkId) {
          throw new Error("checkout.session.completed missing client_reference_id");
        }
        if (!stripeCustomerId) {
          throw new Error("checkout.session.completed missing customer");
        }

        // Get subscription details if present
        let subscriptionStatus: SubscriptionStatus = null;
        let subscriptionPlan: "monthly" | "annual" | null = null;
        let subscriptionEndDate: number | null = null;

        const subscriptionId = extractSubscriptionId(session.subscription);
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
            expand: ["items.data"],
          });
          subscriptionStatus = "active";
          subscriptionPlan = (subscription.metadata.plan as "monthly" | "annual") || "monthly";
          subscriptionEndDate = getSubscriptionPeriodEnd(subscription) * 1000;
        }

        await convexClient.action(api.stripe.webhookAction.processWebhookEvent, {
          secret: syncSecret,
          eventType: "checkout.session.completed",
          payload: {
            clerkId,
            stripeCustomerId,
            subscriptionStatus,
            subscriptionPlan,
            subscriptionEndDate,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = extractCustomerId(subscription.customer);

        if (!stripeCustomerId) {
          throw new Error("customer.subscription.updated missing customer");
        }

        const subscriptionStatus = STATUS_MAP[subscription.status] ?? null;
        const subscriptionPlan = (subscription.metadata.plan as "monthly" | "annual") || "monthly";
        const subscriptionEndDate = getSubscriptionPeriodEnd(subscription) * 1000;

        await convexClient.action(api.stripe.webhookAction.processWebhookEvent, {
          secret: syncSecret,
          eventType: "customer.subscription.updated",
          payload: {
            stripeCustomerId,
            subscriptionStatus,
            subscriptionPlan,
            subscriptionEndDate,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = extractCustomerId(subscription.customer);

        if (!stripeCustomerId) {
          throw new Error("customer.subscription.deleted missing customer");
        }

        await convexClient.action(api.stripe.webhookAction.processWebhookEvent, {
          secret: syncSecret,
          eventType: "customer.subscription.deleted",
          payload: { stripeCustomerId },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = extractCustomerId(invoice.customer);

        if (!stripeCustomerId) {
          throw new Error("invoice.payment_failed missing customer");
        }

        // Only handle subscription-related invoices
        const billingReason = invoice.billing_reason;
        if (
          billingReason &&
          [
            "subscription_create",
            "subscription_cycle",
            "subscription_update",
            "subscription_threshold",
          ].includes(billingReason)
        ) {
          await convexClient.action(api.stripe.webhookAction.processWebhookEvent, {
            secret: syncSecret,
            eventType: "invoice.payment_failed",
            payload: { stripeCustomerId },
          });
        }
        break;
      }

      default:
        logger.info(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[stripe-webhook] Error processing ${event.type}: ${message}`);
    // Return 200 to acknowledge receipt - Stripe will retry on 4xx/5xx
    return NextResponse.json({ received: true, error: message });
  }
}
