"use client";

import { useUser } from "@clerk/nextjs";
import { NavbarButton } from "@/components/ui/NavbarButton";
import { Settings } from "lucide-react";

/**
 * Admin Button - Conditional navigation to admin dashboard
 *
 * Only visible to users with admin role in Clerk publicMetadata.
 * Checks: publicMetadata.role === "admin" OR "admin" in publicMetadata.roles array
 */
export function AdminButton() {
  const { isLoaded, user } = useUser();

  // Don't render until auth is loaded
  if (!isLoaded || !user) {
    return null;
  }

  // Check for admin role in public metadata
  const isAdmin =
    user.publicMetadata?.role === "admin" ||
    (Array.isArray(user.publicMetadata?.roles) && user.publicMetadata.roles.includes("admin"));

  // Only render button for admin users
  if (!isAdmin) {
    return null;
  }

  return (
    <NavbarButton
      href="/admin/dashboard"
      title="Admin dashboard"
      aria-label="Open admin dashboard"
      overlayColor="primary"
    >
      <Settings className="h-5 w-5" />
    </NavbarButton>
  );
}
