import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { stripe, PRICES, PricePlan } from "@/lib/stripe";
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

    const priceId = PRICES[plan];
    if (!priceId) {
      logger.error(`[checkout] Missing price ID for plan: ${plan}`);
      return NextResponse.json({ error: "Price configuration error" }, { status: 500 });
    }

    // Get user's primary email
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;

    // Build success/cancel URLs
    const origin =
      req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${origin}/archive?checkout=success`;
    const cancelUrl = `${origin}/pricing`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
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
      subscription_data: {
        metadata: {
          clerkId: user.id,
          plan,
        },
      },
    });

    logger.info(`[checkout] Created session for user ${user.id}, plan: ${plan}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("[checkout] Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
