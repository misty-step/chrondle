"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | null | undefined;
type SubscriptionPlan = "monthly" | "annual" | null | undefined;

interface SubscriptionCardProps {
  hasStripeCustomer: boolean;
  initialPlan?: SubscriptionPlan;
  initialStatus?: SubscriptionStatus;
  initialEndDate?: number | null;
}

type SubscriptionSnapshot = {
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionEndDate?: number | null;
};

const STATUS_STYLES: Record<
  Exclude<SubscriptionStatus, null | undefined>,
  { label: string; message: (dateLabel: string) => string; badgeClass: string }
> = {
  active: {
    label: "Active",
    message: (dateLabel) =>
      dateLabel === "—" ? "Subscription active." : `Subscription active. Renews on ${dateLabel}.`,
    badgeClass: "bg-feedback-success/10 text-feedback-success border-feedback-success/30",
  },
  trialing: {
    label: "Trialing",
    message: (dateLabel) =>
      dateLabel === "—" ? "Trial active." : `Trial active. Billing begins on ${dateLabel}.`,
    badgeClass: "bg-feedback-info/10 text-feedback-info border-feedback-info/30",
  },
  canceled: {
    label: "Canceled",
    message: (dateLabel) =>
      dateLabel === "—"
        ? "Canceled. Access remains until the end of the period."
        : `Canceled. Access remains until ${dateLabel}.`,
    badgeClass: "bg-feedback-warning/10 text-feedback-warning border-feedback-warning/30",
  },
  past_due: {
    label: "Past Due",
    message: () => "Payment failed. Update your payment method to keep access.",
    badgeClass: "bg-feedback-error/10 text-feedback-error border-feedback-error/30",
  },
};

function formatBillingDate(timestamp?: number | null): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPlan(plan: SubscriptionPlan): string {
  if (plan === "annual") return "Annual Archive";
  if (plan === "monthly") return "Monthly Archive";
  return "Free";
}

export function SubscriptionCard({
  hasStripeCustomer,
  initialPlan,
  initialStatus,
  initialEndDate,
}: SubscriptionCardProps) {
  const subscription = useQuery(api.users.getSubscriptionStatus) as
    | (SubscriptionSnapshot & { hasArchiveAccess?: boolean })
    | null
    | undefined;
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const initialData = useMemo(() => {
    if (initialPlan === undefined && initialStatus === undefined && initialEndDate === undefined) {
      return null;
    }
    return {
      subscriptionPlan: initialPlan ?? null,
      subscriptionStatus: initialStatus ?? null,
      subscriptionEndDate: initialEndDate ?? null,
    };
  }, [initialEndDate, initialPlan, initialStatus]);

  const resolved = subscription === undefined ? initialData : subscription;
  const isLoading = subscription === undefined && !initialData;

  const status = resolved?.subscriptionStatus ?? null;
  const plan = resolved?.subscriptionPlan ?? null;
  const endDate = resolved?.subscriptionEndDate ?? null;
  const billingLabel = formatBillingDate(endDate);

  const statusMeta = status ? STATUS_STYLES[status] : null;
  const statusMessage = statusMeta
    ? statusMeta.message(billingLabel)
    : hasStripeCustomer
      ? "Subscription details are syncing. Try again in a moment."
      : "No subscription yet. Pick a plan to unlock the archive.";

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      let data: { url?: string; error?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data?.url) {
        logger.error("[SubscriptionCard] Portal session failed:", response.status, data);
        setPortalError("Unable to open the customer portal.");
        setPortalLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      logger.error("[SubscriptionCard] Portal error:", error);
      setPortalError("Unable to open the customer portal.");
      setPortalLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>Manage your plan and billing details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="bg-muted-foreground/30 h-4 w-4 animate-pulse rounded-full" />
            Loading subscription...
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Plan
                </div>
                <div className="text-foreground mt-2 text-lg font-semibold">{formatPlan(plan)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Status
                </div>
                <div className="mt-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      statusMeta?.badgeClass ??
                        "border-outline-default/40 bg-surface-elevated text-muted-foreground",
                    )}
                  >
                    {statusMeta?.label ?? "No subscription"}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Next billing date
                </div>
                <div className="text-foreground mt-2 text-lg font-semibold">{billingLabel}</div>
              </div>
            </div>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {statusMessage}
            </p>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        {hasStripeCustomer ? (
          <Button onClick={handleManageSubscription} disabled={portalLoading}>
            {portalLoading ? "Opening..." : "Manage Subscription"}
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/pricing">Subscribe</Link>
          </Button>
        )}
        {portalError && (
          <span className="text-feedback-error text-xs" role="alert">
            {portalError}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
