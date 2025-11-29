import React from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { PoolHealthCard } from "@/components/admin/PoolHealthCard";
import { CostTrendsChart } from "@/components/admin/CostTrendsChart";
import { QualityMetricsGrid } from "@/components/admin/QualityMetricsGrid";
import { RecentGenerationsTable } from "@/components/admin/RecentGenerationsTable";

/**
 * Admin Dashboard - Event Generation Observability
 *
 * Provides real-time monitoring of:
 * - Event pool health (unused events, depletion timeline, era coverage)
 * - Cost trends (daily spending, 7-day averages, cost per event)
 * - Quality metrics (scores, failure rates, trends)
 * - Recent generation attempts (debug view)
 *
 * Access: Restricted to users with admin role in Clerk metadata
 * Auto-refresh: 30 seconds (client-side Convex subscriptions)
 */
export default async function AdminDashboardPage() {
  // Auth check: Only allow admin users
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/admin/dashboard");
  }

  // Check for admin role in public metadata
  // Clerk stores roles in user.publicMetadata.role or user.publicMetadata.roles
  const isAdmin =
    user.publicMetadata?.role === "admin" ||
    (Array.isArray(user.publicMetadata?.roles) && user.publicMetadata.roles.includes("admin"));

  if (!isAdmin) {
    // Non-admin users get redirected to home with error message
    redirect("/?error=unauthorized");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-text-primary text-3xl font-bold md:text-4xl">
              Admin Dashboard
            </h1>
            <p className="text-text-secondary mt-2 text-sm">
              Event generation observability and monitoring
            </p>
          </div>

          {/* 4-Panel Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pool Health */}
            <div className="lg:col-span-1">
              <PoolHealthCard />
            </div>

            {/* Cost Trends */}
            <div className="lg:col-span-1">
              <CostTrendsChart />
            </div>

            {/* Quality Metrics */}
            <div className="lg:col-span-1">
              <QualityMetricsGrid />
            </div>

            {/* Recent Generations - Full Width */}
            <div className="lg:col-span-2">
              <RecentGenerationsTable />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
