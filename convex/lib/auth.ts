"use node";

import { ConvexError } from "convex/values";

export type AuthIdentity = {
  subject?: string;
  email?: string;
  publicMetadata?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
} | null;

export type AuthCtx = {
  auth: {
    getUserIdentity: () => Promise<AuthIdentity>;
  };
};

/**
 * Server-side admin check.
 *
 * - Derives role from the authenticated identity's public metadata (Clerk).
 * - Rejects when unauthenticated or role !== "admin".
 * - Never trusts client-provided flags or user IDs.
 */
export async function requireAdmin(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }

  const role =
    (identity.publicMetadata?.role as string | undefined) ??
    (identity.metadata?.role as string | undefined);

  if (role !== "admin") {
    throw new ConvexError("Forbidden: admin only");
  }

  return identity;
}
