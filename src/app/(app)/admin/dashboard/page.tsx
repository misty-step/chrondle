import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { AdminTabs } from "./components/AdminTabs";

/**
 * Admin Dashboard - Event Generation Command Center
 *
 * Provides real-time monitoring and management of:
 * - Overview: Pool health, cost trends, quality metrics, recent generations
 * - Events: Browse, search, filter, edit the event pool
 * - Puzzles: View puzzle history for Classic and Order modes
 *
 * Access: Restricted to users with admin role in Clerk metadata
 * Auto-refresh: Real-time via Convex subscriptions
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
              Event generation observability and content management
            </p>
          </div>

          {/* Tab Navigation + Content */}
          <Suspense
            fallback={
              <div className="animate-pulse space-y-4">
                <div className="bg-surface-secondary h-10 w-64 rounded" />
                <div className="bg-surface-secondary h-64 rounded-lg" />
              </div>
            }
          >
            <AdminTabs />
          </Suspense>
        </div>
      </main>

      <Footer />
    </div>
  );
}
