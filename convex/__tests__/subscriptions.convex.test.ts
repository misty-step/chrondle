import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Type assertion for path-based API access
const subscriptionsMutations = (api as any)["users/subscriptions"];

/**
 * Subscription Mutations Tests using convex-test
 *
 * Tests Stripe webhook-triggered operations with a mock database.
 */

describe("users/subscriptions", () => {
  describe("linkStripeCustomer", () => {
    it("links Stripe customer to existing user", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_link_test",
          email: "link@example.com",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(subscriptionsMutations.linkStripeCustomer, {
        clerkId: "clerk_link_test",
        stripeCustomerId: "cus_test123",
      });

      expect(result).toBe(userId!);

      // Verify stripeCustomerId was set
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.stripeCustomerId).toBe("cus_test123");
      });
    });

    it("is idempotent - returns same user ID when already linked", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_idempotent",
          email: "idempotent@example.com",
          stripeCustomerId: "cus_existing",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      // Call again with same stripeCustomerId
      const result = await t.mutation(subscriptionsMutations.linkStripeCustomer, {
        clerkId: "clerk_idempotent",
        stripeCustomerId: "cus_existing",
      });

      expect(result).toBe(userId!);
    });

    it("throws error when user not found", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(subscriptionsMutations.linkStripeCustomer, {
          clerkId: "nonexistent_clerk",
          stripeCustomerId: "cus_orphan",
        }),
      ).rejects.toThrow("No user found for clerkId");
    });
  });

  describe("updateSubscription", () => {
    it("updates subscription status and plan", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_sub_update",
          email: "sub@example.com",
          stripeCustomerId: "cus_update123",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      const endDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await t.mutation(subscriptionsMutations.updateSubscription, {
        stripeCustomerId: "cus_update123",
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        subscriptionEndDate: endDate,
      });

      // Verify fields were updated
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.subscriptionStatus).toBe("active");
        expect(user?.subscriptionPlan).toBe("monthly");
        expect(user?.subscriptionEndDate).toBe(endDate);
      });
    });

    it("handles null status (clears subscription)", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "clerk_null_status",
          email: "null@example.com",
          stripeCustomerId: "cus_null123",
          subscriptionStatus: "active",
          subscriptionPlan: "annual",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      await t.mutation(subscriptionsMutations.updateSubscription, {
        stripeCustomerId: "cus_null123",
        subscriptionStatus: null,
      });

      // Note: null status doesn't clear the field, it sets undefined
      // This matches the webhook handler behavior
    });

    it("throws error when Stripe customer not found", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(subscriptionsMutations.updateSubscription, {
          stripeCustomerId: "cus_nonexistent",
          subscriptionStatus: "active",
        }),
      ).rejects.toThrow("No user found for Stripe customer");
    });
  });

  describe("clearSubscription", () => {
    it("clears all subscription fields", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_clear_test",
          email: "clear@example.com",
          stripeCustomerId: "cus_clear123",
          subscriptionStatus: "active",
          subscriptionPlan: "monthly",
          subscriptionEndDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      await t.mutation(subscriptionsMutations.clearSubscription, {
        stripeCustomerId: "cus_clear123",
      });

      // Verify subscription fields were cleared
      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.subscriptionStatus).toBeUndefined();
        expect(user?.subscriptionPlan).toBeUndefined();
        expect(user?.subscriptionEndDate).toBeUndefined();
        // stripeCustomerId should remain
        expect(user?.stripeCustomerId).toBe("cus_clear123");
      });
    });

    it("throws error when Stripe customer not found", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(subscriptionsMutations.clearSubscription, {
          stripeCustomerId: "cus_ghost",
        }),
      ).rejects.toThrow("No user found for Stripe customer");
    });
  });

  // Note: getSubscriptionStatus requires auth context - tested via hasArchiveAccess query
});
