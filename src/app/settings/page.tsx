import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { LayoutContainer } from "@/components/LayoutContainer";
import { SubscriptionCard } from "@/components/settings/SubscriptionCard";
import { api, requireConvexClient } from "@/lib/convexServer";
import { logger } from "@/lib/logger";

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/settings");
  }

  let hasStripeCustomer = false;
  let initialPlan: "monthly" | "annual" | null | undefined;
  let initialStatus: "active" | "trialing" | "canceled" | "past_due" | null | undefined;
  let initialEndDate: number | null | undefined;

  try {
    const convex = requireConvexClient();
    const user = await convex.query(api.users.getUserByClerkId, { clerkId: userId });
    hasStripeCustomer = !!user?.stripeCustomerId;
    initialPlan = user?.subscriptionPlan ?? null;
    initialStatus = user?.subscriptionStatus ?? null;
    initialEndDate = user?.subscriptionEndDate ?? null;
  } catch (error) {
    logger.error("[Settings] Failed to load subscription data:", error);
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 py-10 sm:py-12">
        <LayoutContainer>
          <div className="mb-8">
            <h1 className="font-heading text-foreground text-3xl font-bold sm:text-4xl">
              Settings
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Manage your subscription and billing details.
            </p>
          </div>

          <SubscriptionCard
            hasStripeCustomer={hasStripeCustomer}
            initialPlan={initialPlan}
            initialStatus={initialStatus}
            initialEndDate={initialEndDate}
          />
        </LayoutContainer>
      </main>

      <Footer />
    </div>
  );
}
