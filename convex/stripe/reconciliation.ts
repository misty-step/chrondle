import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Stripe/DB Reconciliation
 *
 * Detects drift between Stripe subscription state and Convex database.
 * Runs daily via cron to catch missed webhooks before they cause issues.
 *
 * Scenarios detected:
 * 1. Active in Stripe, missing/inactive in DB → Webhook missed
 * 2. Active in DB, canceled in Stripe → Cancel webhook missed
 * 3. Customer in Stripe, no user in DB → Orphan customer
 *
 * This is alerting only - does NOT auto-fix. Manual intervention required.
 */

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
}

interface StripeListResponse {
  data: StripeSubscription[];
  has_more: boolean;
}

export const runReconciliation = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    driftDetected: boolean;
    issues: Array<{
      type: string;
      stripeCustomerId: string;
      details: string;
    }>;
    stats: {
      stripeActive: number;
      dbActive: number;
      checked: number;
    };
  }> => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey) {
      console.error("[reconciliation] STRIPE_SECRET_KEY not set");
      return {
        driftDetected: true,
        issues: [
          { type: "config", stripeCustomerId: "", details: "STRIPE_SECRET_KEY not configured" },
        ],
        stats: { stripeActive: 0, dbActive: 0, checked: 0 },
      };
    }

    // Validate key format
    if (!stripeSecretKey.match(/^sk_(test|live)_/)) {
      console.error("[reconciliation] Invalid STRIPE_SECRET_KEY format");
      return {
        driftDetected: true,
        issues: [
          { type: "config", stripeCustomerId: "", details: "Invalid STRIPE_SECRET_KEY format" },
        ],
        stats: { stripeActive: 0, dbActive: 0, checked: 0 },
      };
    }

    const issues: Array<{ type: string; stripeCustomerId: string; details: string }> = [];

    // 1. Get active subscriptions from Stripe
    let stripeSubscriptions: StripeSubscription[] = [];
    try {
      const response = await fetch(
        "https://api.stripe.com/v1/subscriptions?status=active&limit=100",
        {
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stripe API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as StripeListResponse;
      stripeSubscriptions = data.data;

      // Note: For > 100 subscriptions, implement pagination with has_more
      if (data.has_more) {
        console.warn("[reconciliation] More than 100 active subscriptions - implement pagination");
      }
    } catch (error) {
      console.error("[reconciliation] Failed to fetch Stripe subscriptions:", error);
      return {
        driftDetected: true,
        issues: [{ type: "api_error", stripeCustomerId: "", details: String(error) }],
        stats: { stripeActive: 0, dbActive: 0, checked: 0 },
      };
    }

    // 2. Get active subscriptions from DB
    const dbUsers = await ctx.runQuery(internal.stripe.reconciliationQueries.getActiveSubscribers);

    // Build lookup map for Stripe customers
    const stripeCustomerIds = new Set(stripeSubscriptions.map((s) => s.customer));

    // 3. Check for drift

    // Scenario 1: Active in Stripe, not active in DB
    for (const sub of stripeSubscriptions) {
      const dbUser = dbUsers.find((u) => u.stripeCustomerId === sub.customer);

      if (!dbUser) {
        // Customer exists in Stripe but not linked to any user
        issues.push({
          type: "orphan_customer",
          stripeCustomerId: sub.customer,
          details: `Subscription ${sub.id} active in Stripe but customer not linked to any user`,
        });
      } else if (dbUser.subscriptionStatus !== "active") {
        // Customer linked but status mismatch
        issues.push({
          type: "status_mismatch",
          stripeCustomerId: sub.customer,
          details: `Stripe: active, DB: ${dbUser.subscriptionStatus ?? "null"} (webhook missed?)`,
        });
      }
    }

    // Scenario 2: Active in DB, not active in Stripe
    for (const user of dbUsers) {
      if (user.subscriptionStatus === "active" && user.stripeCustomerId) {
        if (!stripeCustomerIds.has(user.stripeCustomerId)) {
          issues.push({
            type: "ghost_subscription",
            stripeCustomerId: user.stripeCustomerId,
            details: `DB shows active but no active subscription in Stripe (cancel webhook missed?)`,
          });
        }
      }
    }

    // Log results
    const stats = {
      stripeActive: stripeSubscriptions.length,
      dbActive: dbUsers.filter((u) => u.subscriptionStatus === "active").length,
      checked: Math.max(stripeSubscriptions.length, dbUsers.length),
    };

    if (issues.length > 0) {
      console.error(`[reconciliation] DRIFT DETECTED: ${issues.length} issue(s)`);
      for (const issue of issues) {
        console.error(`  - [${issue.type}] ${issue.stripeCustomerId}: ${issue.details}`);
      }
    } else {
      console.log(
        `[reconciliation] OK: ${stats.stripeActive} Stripe active, ${stats.dbActive} DB active`,
      );
    }

    return {
      driftDetected: issues.length > 0,
      issues,
      stats,
    };
  },
});
