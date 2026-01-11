import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { stripe } from "@/lib/stripe";
import { getEnvVar } from "@/lib/env";
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

    // Get Convex client
    const convexUrl = getEnvVar("NEXT_PUBLIC_CONVEX_URL");
    if (!convexUrl) {
      logger.error("[portal] NEXT_PUBLIC_CONVEX_URL not configured");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const convexClient = new ConvexHttpClient(convexUrl);

    // Get user's Stripe customer ID from Convex
    const convexUser = await convexClient.query(api.users.getUserByClerkId, {
      clerkId: user.id,
    });

    if (!convexUser?.stripeCustomerId) {
      logger.warn(`[portal] No Stripe customer for user ${user.id}`);
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // Build return URL
    const origin =
      req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${origin}/archive`;

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
