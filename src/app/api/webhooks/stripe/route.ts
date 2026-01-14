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
 * Returns the customer ID string, or null if invalid
 */
function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (typeof customer === "string") {
    return customer;
  }
  if (customer && "id" in customer) {
    return customer.id;
  }
  return null;
}

/**
 * Extract period end from subscription's first item.
 * In Stripe API 2025+, current_period_end is on SubscriptionItem, not Subscription.
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number {
  const firstItem = subscription.items.data[0];
  if (!firstItem?.current_period_end) {
    throw new Error(`Subscription ${subscription.id} missing current_period_end`);
  }
  return firstItem.current_period_end;
}

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for subscription lifecycle.
 * Events: checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed
 */
export async function POST(req: NextRequest) {
  let convexClient: ConvexHttpClient;
  try {
    convexClient = requireConvexClient();
  } catch {
    logger.error("[stripe-webhook] NEXT_PUBLIC_CONVEX_URL not configured");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
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

  // Verify webhook signature
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(convexClient, session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(convexClient, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(convexClient, subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(convexClient, invoice);
        break;
      }

      default:
        logger.info(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[stripe-webhook] Error processing ${event.type}: ${message}`);
    // Return 200 to acknowledge receipt (Stripe will retry on 4xx/5xx)
    // Log error for investigation but don't block webhook delivery
    return NextResponse.json({ received: true, error: message });
  }
}

/**
 * Handle checkout.session.completed
 *
 * Links Stripe customer to user and activates subscription.
 */
async function handleCheckoutCompleted(client: ConvexHttpClient, session: Stripe.Checkout.Session) {
  const clerkId = session.client_reference_id;
  const stripeCustomerId = extractCustomerId(session.customer);

  if (!clerkId) {
    logger.error("[stripe-webhook] checkout.session.completed missing client_reference_id");
    throw new Error("Missing client_reference_id");
  }

  if (!stripeCustomerId) {
    logger.error(
      `[stripe-webhook] checkout.session.completed has invalid customer: ${JSON.stringify(session.customer)}`,
    );
    throw new Error("Invalid or missing customer");
  }

  // Link Stripe customer to Convex user
  await client.mutation(api.users.linkStripeCustomer, {
    clerkId,
    stripeCustomerId,
  });

  // Get subscription details
  const subscriptionId = session.subscription as string;
  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
      expand: ["items.data"],
    });
    const plan = (subscription.metadata.plan as "monthly" | "annual") || "monthly";
    const periodEnd = getSubscriptionPeriodEnd(subscription);

    await client.mutation(api.users.updateSubscription, {
      stripeCustomerId,
      subscriptionStatus: "active",
      subscriptionPlan: plan,
      subscriptionEndDate: periodEnd * 1000, // Convert to ms
    });
  }

  logger.info(`[stripe-webhook] Checkout completed for clerkId: ${clerkId}`);
}

/**
 * Handle customer.subscription.updated
 *
 * Updates subscription status and period end date.
 */
async function handleSubscriptionUpdated(
  client: ConvexHttpClient,
  subscription: Stripe.Subscription,
) {
  const stripeCustomerId = extractCustomerId(subscription.customer);

  if (!stripeCustomerId) {
    logger.error(
      `[stripe-webhook] customer.subscription.updated has invalid customer: ${JSON.stringify(subscription.customer)}`,
    );
    throw new Error("Invalid or missing customer");
  }

  const plan = (subscription.metadata.plan as "monthly" | "annual") || "monthly";
  const subscriptionStatus = STATUS_MAP[subscription.status] ?? null;
  const periodEnd = getSubscriptionPeriodEnd(subscription);

  await client.mutation(api.users.updateSubscription, {
    stripeCustomerId,
    subscriptionStatus,
    subscriptionPlan: plan,
    subscriptionEndDate: periodEnd * 1000,
  });

  logger.info(
    `[stripe-webhook] Subscription updated for customer: ${stripeCustomerId}, status: ${subscriptionStatus}`,
  );
}

/**
 * Handle customer.subscription.deleted
 *
 * Clears subscription when fully canceled.
 */
async function handleSubscriptionDeleted(
  client: ConvexHttpClient,
  subscription: Stripe.Subscription,
) {
  const stripeCustomerId = extractCustomerId(subscription.customer);

  if (!stripeCustomerId) {
    logger.error(
      `[stripe-webhook] customer.subscription.deleted has invalid customer: ${JSON.stringify(subscription.customer)}`,
    );
    throw new Error("Invalid or missing customer");
  }

  await client.mutation(api.users.clearSubscription, {
    stripeCustomerId,
  });

  logger.info(`[stripe-webhook] Subscription deleted for customer: ${stripeCustomerId}`);
}

/**
 * Handle invoice.payment_failed
 *
 * Marks subscription as past_due when payment fails.
 */
async function handlePaymentFailed(client: ConvexHttpClient, invoice: Stripe.Invoice) {
  const stripeCustomerId = extractCustomerId(invoice.customer);

  if (!stripeCustomerId) {
    logger.error(
      `[stripe-webhook] invoice.payment_failed has invalid customer: ${JSON.stringify(invoice.customer)}`,
    );
    throw new Error("Invalid or missing customer");
  }

  // Only update if this is a subscription-related invoice
  const billingReason = invoice.billing_reason;
  if (
    !billingReason ||
    ![
      "subscription_create",
      "subscription_cycle",
      "subscription_update",
      "subscription_threshold",
    ].includes(billingReason)
  ) {
    return;
  }

  await client.mutation(api.users.updateSubscription, {
    stripeCustomerId,
    subscriptionStatus: "past_due",
  });

  logger.info(`[stripe-webhook] Payment failed for customer: ${stripeCustomerId}`);
}
