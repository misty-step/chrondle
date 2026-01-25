import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { api, requireConvexClient } from "@/lib/convexServer";
import { getStripe, getAppOrigin } from "@/lib/stripe";
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

    // Get user's Stripe customer ID from Convex
    const convex = requireConvexClient();
    const dbUser = await convex.query(api.users.getUserByClerkId, {
      clerkId: user.id,
    });

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const origin = getAppOrigin(req);
    const session = await getStripe().billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("[portal] Failed to create portal session:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
