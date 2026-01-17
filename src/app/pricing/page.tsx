"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { Check, Archive, Sparkles } from "lucide-react";
import { logger } from "@/lib/logger";

type Plan = "monthly" | "annual";

export default function PricingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState<Plan | null>(null);

  const handleSubscribe = async (plan: Plan) => {
    // If not signed in, redirect to sign-in
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/pricing`);
      return;
    }

    setLoading(plan);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      // Handle non-JSON and error responses
      let data: { url?: string; error?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        // Non-JSON response
      }

      if (!response.ok) {
        logger.error("Checkout session request failed:", response.status, data);
        setLoading(null);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        logger.error("Failed to create checkout session:", data?.error);
        setLoading(null);
      }
    } catch (error) {
      logger.error("Checkout error:", error);
      setLoading(null);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader currentStreak={0} />

      <main className="mx-auto w-full max-w-3xl flex-grow px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-10 text-center">
          <h1 className="font-heading text-foreground mb-3 text-3xl font-bold sm:text-4xl">
            Unlock the Archive
          </h1>
          <p className="text-muted-foreground mx-auto max-w-lg text-lg">
            Play today&apos;s puzzle free, forever. Subscribe to unlock 150+ historical puzzles in
            the archive.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          {/* Monthly Plan */}
          <Card className="relative flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">Monthly</CardTitle>
              <CardDescription>Flexible month-to-month access</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-grow flex-col">
              <div className="mb-6">
                <span className="text-foreground text-4xl font-bold">$0.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="text-body-secondary mb-6 flex-grow space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Full access to puzzle archive</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Scores count toward streaks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Cancel anytime</span>
                </li>
              </ul>
              <Button
                onClick={() => handleSubscribe("monthly")}
                disabled={loading !== null}
                variant="outline"
                className="w-full"
              >
                {loading === "monthly" ? "Loading..." : "Subscribe Monthly"}
              </Button>
            </CardContent>
          </Card>

          {/* Annual Plan */}
          <Card className="border-primary relative flex flex-col border-2">
            <div className="bg-primary text-background absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase">
              Save 16%
            </div>
            <CardHeader>
              <CardTitle className="text-xl">Annual</CardTitle>
              <CardDescription>Best value for history buffs</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-grow flex-col">
              <div className="mb-6">
                <span className="text-foreground text-4xl font-bold">$9.99</span>
                <span className="text-muted-foreground">/year</span>
                <div className="text-muted-foreground mt-1 text-sm">~$0.83/month</div>
              </div>
              <ul className="text-body-secondary mb-6 flex-grow space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Full access to puzzle archive</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Scores count toward streaks</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>One payment, full year</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>Support independent development</span>
                </li>
              </ul>
              <Button
                onClick={() => handleSubscribe("annual")}
                disabled={loading !== null}
                className="w-full"
              >
                {loading === "annual" ? "Loading..." : "Subscribe Annually"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Value Props */}
        <div className="border-outline-default/30 bg-surface-elevated rounded-sm border p-6">
          <h2 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
            <Archive className="h-5 w-5" />
            What&apos;s in the Archive?
          </h2>
          <ul className="text-body-secondary grid gap-2 text-sm sm:grid-cols-2">
            <li>150+ unique historical puzzles</li>
            <li>Events spanning 5000+ years</li>
            <li>Classic mode: guess the year</li>
            <li>Order mode: arrange events chronologically</li>
            <li>Track your progress and stats</li>
            <li>New puzzles added daily</li>
          </ul>
        </div>

        {/* FAQ-like note */}
        <p className="text-muted-foreground mt-8 text-center text-sm">
          Today&apos;s puzzle is always free. Secure payment via Stripe. Cancel anytime from your
          account.
        </p>
      </main>

      <Footer />
    </div>
  );
}
