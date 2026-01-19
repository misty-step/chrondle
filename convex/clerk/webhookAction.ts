import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Clerk Webhook Gateway - Single entry point for user sync from Clerk
 *
 * Security Model:
 * - Next.js route verifies Svix signature (cryptographic proof from Clerk)
 * - This action verifies shared secret (prevents direct calls)
 * - Internal mutation is physically uncallable from clients
 */

/**
 * Process a verified Clerk webhook event
 *
 * Called by Next.js API route AFTER Svix signature verification.
 * Validates shared secret and routes to internal user mutation.
 */
export const processWebhookEvent = action({
  args: {
    secret: v.string(),
    eventType: v.union(v.literal("user.created"), v.literal("user.updated")),
    payload: v.object({
      clerkId: v.string(),
      email: v.string(),
    }),
  },
  returns: v.object({ userId: v.id("users") }),
  handler: async (ctx, { secret, eventType, payload }): Promise<{ userId: Id<"users"> }> => {
    // Validate shared secret
    const expectedSecret = process.env.CLERK_SYNC_SECRET;
    if (!expectedSecret) {
      throw new Error("CLERK_SYNC_SECRET not configured in Convex environment");
    }
    if (secret !== expectedSecret) {
      console.error("[clerk-webhook-action] Invalid secret provided");
      throw new Error("Unauthorized: invalid webhook secret");
    }

    // Create or update user via internal mutation
    const userId: Id<"users"> = await ctx.runMutation(internal.users.mutations.createUser, {
      clerkId: payload.clerkId,
      email: payload.email,
    });

    console.log(
      `[clerk-webhook-action] Processed ${eventType} for user ${payload.clerkId} -> ${userId}`,
    );

    return { userId };
  },
});
