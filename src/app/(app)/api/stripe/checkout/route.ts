import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { currentUser } from "@clerk/nextjs/server";
import { requireConvexClient, api } from "@/lib/convexServer";
import { getStripe, getPriceId, PricePlan, getAppOrigin } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for subscription purchase.
 * Requires authenticated user. Returns checkout URL for redirect.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate user is authenticated
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const plan = body.plan as PricePlan;

    if (!plan || !["monthly", "annual"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'monthly' or 'annual'" },
        { status: 400 },
      );
    }

    // getPriceId throws if env var not configured
    const priceId = getPriceId(plan);

    // Get user's primary email
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;

    // Build success/cancel URLs
    const origin = getAppOrigin(req);
    const successUrl = `${origin}/archive?checkout=success`;
    const cancelUrl = `${origin}/pricing`;

    // Check if user has remaining trial time (business model: honor trial on upgrade)
    let trialEnd: number | undefined;
    try {
      const convex = requireConvexClient();
      const dbUser = await convex.query(api.users.queries.getUserByClerkId, {
        clerkId: user.id,
      });
      if (dbUser?.trialEndsAt && dbUser.trialEndsAt > Date.now()) {
        // Convert ms to seconds for Stripe (Stripe uses Unix timestamps in seconds)
        trialEnd = Math.floor(dbUser.trialEndsAt / 1000);
        logger.info(
          `[checkout] User ${user.id} has trial ending at ${new Date(dbUser.trialEndsAt).toISOString()}`,
        );
      }
    } catch (err) {
      // Non-fatal: proceed without trial if we can't check
      logger.warn("[checkout] Failed to check trial status, proceeding without trial:", err);
    }

    // Build subscription_data with optional trial_end
    const subscriptionData: Stripe.Checkout.SessionCreateParams["subscription_data"] = {
      metadata: {
        clerkId: user.id,
        plan,
      },
    };
    if (trialEnd) {
      subscriptionData.trial_end = trialEnd;
    }

    // Create Checkout Session
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Link session to user via clerkId for webhook processing
      client_reference_id: user.id,
      // Pre-fill email for new customers
      customer_email: email,
      // Redirect URLs
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Allow promotion codes if we add them later
      allow_promotion_codes: false,
      // Subscription metadata
      subscription_data: subscriptionData,
    });

    logger.info(
      `[checkout] Created session for user ${user.id}, plan: ${plan}${trialEnd ? `, trial_end: ${trialEnd}` : ""}`,
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("[checkout] Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
