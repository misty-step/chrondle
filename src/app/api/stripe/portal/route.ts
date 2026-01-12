import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { api, requireConvexClient } from "@/lib/convexServer";
import { stripe, getAppOrigin } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * User can update payment method, view invoices, cancel subscription.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate user is authenticated
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convexClient = requireConvexClient();

    // Get user's Stripe customer ID from Convex
    const convexUser = await convexClient.query(api.users.getUserByClerkId, {
      clerkId: user.id,
    });

    if (!convexUser?.stripeCustomerId) {
      logger.warn(`[portal] No Stripe customer for user ${user.id}`);
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // Build return URL
    const returnUrl = `${getAppOrigin(req)}/archive`;

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: convexUser.stripeCustomerId,
      return_url: returnUrl,
    });

    logger.info(`[portal] Created portal session for user ${user.id}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("[portal] Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
