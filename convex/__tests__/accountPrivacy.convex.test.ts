import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

const api = anyApi as any;
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = async (clerkId: string) =>
      ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.invalid`,
        currentStreak: 0,
        longestStreak: 0,
        totalPlays: 0,
        perfectGames: 0,
        updatedAt: 1,
        subscriptionStatus: "active",
      });
    const a = await user("privacy-a");
    const b = await user("privacy-b");
    const classic = await ctx.db.insert("puzzles", {
      puzzleNumber: 1,
      date: "2024-01-01",
      targetYear: 1969,
      events: ["Synthetic hint"],
      playCount: 0,
      avgGuesses: 0,
      updatedAt: 1,
    });
    const order = await ctx.db.insert("orderPuzzles", {
      puzzleNumber: 1,
      date: "2024-01-01",
      events: [],
      seed: "privacy",
      updatedAt: 1,
    });
    await ctx.db.insert("plays", {
      userId: a,
      puzzleId: classic,
      ranges: [],
      totalScore: 100,
      completedAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("orderPlays", {
      userId: a,
      puzzleId: order,
      ordering: [],
      completedAt: 1,
      updatedAt: 1,
    });
    return { a, b, classic, order };
  });
  return { t, ids };
}

describe("account and history ownership (including compatibility exports)", () => {
  for (const prefix of ["users", "users/queries"]) {
    for (const caller of ["anonymous", "privacy-b", "unprovisioned"]) {
      it(`${prefix}: ${caller} cannot read A's profile, existence or entitlement`, async () => {
        const { t } = await fixture();
        const client = caller === "anonymous" ? t : t.withIdentity({ subject: caller });
        expect(
          await client.query(api[prefix].getUserByClerkId, { clerkId: "privacy-a" }),
        ).toBeNull();
        expect(await client.query(api[prefix].userExists, { clerkId: "privacy-a" })).toEqual({
          exists: false,
        });
        expect(await client.query(api[prefix].hasArchiveAccess, { clerkId: "privacy-a" })).toBe(
          false,
        );
      });
    }
    it(`${prefix}: A can read their account with current and legacy arguments`, async () => {
      const { t, ids } = await fixture();
      const a = t.withIdentity({ subject: "privacy-a" });
      expect(await a.query(api[prefix].getCurrentUser, {})).toMatchObject({ _id: ids.a });
      expect(await a.query(api[prefix].getUserByClerkId, { clerkId: "privacy-a" })).toMatchObject({
        _id: ids.a,
      });
      expect(await a.query(api[prefix].userExists, {})).toMatchObject({
        exists: true,
        userId: ids.a,
      });
      expect(await a.query(api[prefix].userExists, { clerkId: "privacy-a" })).toMatchObject({
        exists: true,
        userId: ids.a,
      });
      expect(await a.query(api[prefix].hasArchiveAccess, {})).toBe(true);
      expect(await a.query(api[prefix].getUserStats, {})).toMatchObject({
        _id: ids.a,
        recentPlays: [{ userId: ids.a }],
      });
    });
    it(`${prefix}: anonymous existence without an ID reveals nothing`, async () => {
      const { t } = await fixture();
      expect(await t.query(api[prefix].userExists, {})).toEqual({ exists: false });
    });
  }

  for (const [prefix, single, history, puzzle] of [
    ["puzzles", "getUserPlay", "getUserCompletedPuzzles", "classic"],
    ["plays/queries", "getUserPlay", "getUserCompletedPuzzles", "classic"],
    ["orderPlays", "getOrderPlay", "getUserCompletedOrderPlays", "order"],
    ["orderPlays/queries", "getOrderPlay", "getUserCompletedOrderPlays", "order"],
  ] as const) {
    for (const caller of ["anonymous", "privacy-b", "unprovisioned"]) {
      it(`${prefix}: ${caller} cannot retrieve A's progress or completion history`, async () => {
        const { t, ids } = await fixture();
        const client = caller === "anonymous" ? t : t.withIdentity({ subject: caller });
        expect(
          await client.query(api[prefix][single], { userId: ids.a, puzzleId: ids[puzzle] }),
        ).toBeNull();
        expect(await client.query(api[prefix][history], { userId: ids.a })).toEqual([]);
      });
    }
    it(`${prefix}: A still reads their progress and history; B reads only B`, async () => {
      const { t, ids } = await fixture();
      const a = t.withIdentity({ subject: "privacy-a" });
      expect(
        await a.query(api[prefix][single], { userId: ids.a, puzzleId: ids[puzzle] }),
      ).toMatchObject({ userId: ids.a });
      expect(await a.query(api[prefix][history], { userId: ids.a })).toHaveLength(1);
      const b = t.withIdentity({ subject: "privacy-b" });
      expect(
        await b.query(api[prefix][single], { userId: ids.b, puzzleId: ids[puzzle] }),
      ).toBeNull();
      expect(await b.query(api[prefix][history], { userId: ids.b })).toEqual([]);
      // Denial is not sticky: the rightful account still works afterward.
      expect(await a.query(api[prefix][history], { userId: ids.a })).toHaveLength(1);
    });
  }

  it("provisions from a verified identity without Clerk webhook settings and reuses the account", async () => {
    vi.stubEnv("CLERK_SYNC_SECRET", "");
    vi.stubEnv("CLERK_WEBHOOK_SECRET", "");
    const { t } = await fixture();
    await expect(t.mutation(api.users.getOrCreateCurrentUser, {})).rejects.toThrow(
      "Not authenticated",
    );
    const player = t.withIdentity({ subject: "privacy-new", email: "new@example.invalid" });
    const first = await player.mutation(api.users.getOrCreateCurrentUser, {});
    expect(first).toMatchObject({ clerkId: "privacy-new", email: "new@example.invalid" });
    const returning = await player.mutation(api.users.getOrCreateCurrentUser, {});
    expect(returning).toEqual(first);
    expect(await player.query(api.users.getCurrentUser, {})).toEqual(first);
    expect(await t.query(api.users.getCurrentUser, {})).toBeNull();
  });

  it("returning verified identities preserve accepted account state without a webhook", async () => {
    const { t, ids } = await fixture();
    const player = t.withIdentity({ subject: "privacy-a" });
    const before = await player.query(api.users.getCurrentUser, {});
    const returning = await player.mutation(api.users.getOrCreateCurrentUser, {});
    expect(returning).toEqual(before);
    expect(returning._id).toBe(ids.a);
    expect(await player.query(api.users.hasArchiveAccess, {})).toBe(true);
    expect(await player.query(api.puzzles.getUserCompletedPuzzles, { userId: ids.a })).toHaveLength(1);
  });

  it("verified billing gateway retains internal account operations, not public-read bypasses", async () => {
    const { t, ids } = await fixture();
    vi.stubEnv("STRIPE_SYNC_SECRET", "synthetic-stripe-secret");
    const stripe = {
      eventType: "checkout.session.completed",
      payload: { clerkId: "privacy-a", stripeCustomerId: "cus_synthetic_privacy" },
    };
    await expect(
      t.action(api.stripe.webhookAction.processWebhookEvent, { ...stripe, secret: "wrong" }),
    ).rejects.toThrow();
    await t.action(api.stripe.webhookAction.processWebhookEvent, {
      ...stripe,
      secret: "synthetic-stripe-secret",
    });
    const a = t.withIdentity({ subject: "privacy-a" });
    expect(await a.query(api.users.getCurrentUser, {})).toMatchObject({
      _id: ids.a,
      stripeCustomerId: "cus_synthetic_privacy",
    });
    expect(await t.query(api.users.getUserByClerkId, { clerkId: "privacy-a" })).toBeNull();
  });
});
