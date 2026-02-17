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

    it("clears trialEndsAt when subscription activates", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      const trialEndsAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_trial_clear",
          email: "trial-clear@example.com",
          stripeCustomerId: "cus_trial123",
          trialEndsAt,
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      await t.mutation(subscriptionsMutations.updateSubscription, {
        stripeCustomerId: "cus_trial123",
        subscriptionStatus: "active",
      });

      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.trialEndsAt).toBeUndefined();
      });
    });

    it("handles null status (sets to null in db)", async () => {
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

      // Verify null status is stored and optional fields unchanged
      await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_stripe", (q) => q.eq("stripeCustomerId", "cus_null123"))
          .first();
        expect(user?.subscriptionStatus).toBeNull();
        // Plan should remain unchanged (not passed in args)
        expect(user?.subscriptionPlan).toBe("annual");
      });
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

    it("skips stale events based on eventTimestamp", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_stale_timestamp",
          email: "stale-timestamp@example.com",
          stripeCustomerId: "cus_stale_timestamp",
          lastStripeEventTimestamp: 1_700_000_001,
          subscriptionStatus: "active",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      await t.mutation(subscriptionsMutations.updateSubscription, {
        stripeCustomerId: "cus_stale_timestamp",
        subscriptionStatus: "canceled",
        eventTimestamp: 1_700_000_000,
        eventId: "evt_stale",
      });

      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.subscriptionStatus).toBe("active");
      });
    });

    it("processes same-second events (no eventId tie-break)", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_same_second",
          email: "same-second@example.com",
          stripeCustomerId: "cus_same_second",
          lastStripeEventTimestamp: 1_700_000_000,
          subscriptionStatus: "active",
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      await t.mutation(subscriptionsMutations.updateSubscription, {
        stripeCustomerId: "cus_same_second",
        subscriptionStatus: "canceled",
        eventTimestamp: 1_700_000_000,
        eventId: "evt_same_second",
      });

      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.subscriptionStatus).toBe("canceled");
        expect(user?.lastStripeEventTimestamp).toBe(1_700_000_000);
        expect(user?.lastStripeEventId).toBe("evt_same_second");
      });
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
    it("skips stale clear events based on eventTimestamp", async () => {
      const t = convexTest(schema, modules);

      let userId: Id<"users">;
      await t.run(async (ctx) => {
        userId = await ctx.db.insert("users", {
          clerkId: "clerk_clear_stale_timestamp",
          email: "clear-stale-timestamp@example.com",
          stripeCustomerId: "cus_clear_stale_timestamp",
          subscriptionStatus: "active",
          subscriptionPlan: "monthly",
          lastStripeEventTimestamp: 1_700_000_001,
          currentStreak: 0,
          longestStreak: 0,
          totalPlays: 0,
          perfectGames: 0,
          updatedAt: Date.now(),
        });
      });

      await t.mutation(subscriptionsMutations.clearSubscription, {
        stripeCustomerId: "cus_clear_stale_timestamp",
        eventTimestamp: 1_700_000_000,
        eventId: "evt_clear_stale",
      });

      await t.run(async (ctx) => {
        const user = await ctx.db.get(userId!);
        expect(user?.subscriptionStatus).toBe("active");
        expect(user?.subscriptionPlan).toBe("monthly");
      });
    });
  });

  // Note: getSubscriptionStatus requires auth context - tested via hasArchiveAccess query
});
