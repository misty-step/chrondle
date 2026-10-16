import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

const api = anyApi;
const metadata = { difficulty: 2, category: ["science"], era: "modern" };

describe("operator-only event operations", () => {
  it.each([null, { subject: "ordinary-player", public_metadata: { role: "player" } }])(
    "rejects unprivileged callers before writes or paid work (%j)",
    async (identity) => {
      const t = convexTest(schema, modules);
      const eventId = await t.run((ctx) =>
        ctx.db.insert("events", { year: 1969, event: "Synthetic event", updatedAt: 1 }),
      );
      const caller = identity ? t.withIdentity(identity) : t;
      const denial = identity ? /Forbidden: admin only/ : /Unauthorized/;

      await expect(
        caller.mutation(api.events.updateEventMetadataPublic, { eventId, metadata }),
      ).rejects.toThrow(denial);
      await expect(
        caller.action(api.actions.eventGeneration.orchestrator.testGenerateYearEvents, {
          year: 1969,
        }),
      ).rejects.toThrow(denial);
      await expect(
        caller.action(api.actions.metadataBackfill.triggerMetadataBackfill, { batchSize: 1 }),
      ).rejects.toThrow(denial);
      expect(await t.run((ctx) => ctx.db.get(eventId))).toMatchObject({ updatedAt: 1 });
      expect((await t.run((ctx) => ctx.db.get(eventId)))?.metadata).toBeUndefined();
    },
  );

  it("allows admin writes and backfill completion after denial, preserving internal writes", async () => {
    const t = convexTest(schema, modules);
    const eventId = await t.run((ctx) =>
      ctx.db.insert("events", { year: 1969, event: "Synthetic event", updatedAt: 1 }),
    );
    const admin = t.withIdentity({ subject: "operator", public_metadata: { role: "admin" } });
    await expect(
      t.mutation(api.events.updateEventMetadataPublic, { eventId, metadata }),
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      admin.mutation(api.events.updateEventMetadataPublic, { eventId, metadata }),
    ).resolves.toEqual({ eventId });
    expect((await t.run((ctx) => ctx.db.get(eventId)))?.metadata).toEqual(metadata);
    await expect(
      admin.action(api.actions.metadataBackfill.triggerMetadataBackfill, {}),
    ).resolves.toMatchObject({ status: "complete", processed: 0 });
    await t.mutation(api.events.updateEventMetadata, {
      eventId,
      metadata: { ...metadata, difficulty: 3 },
    });
    expect((await t.run((ctx) => ctx.db.get(eventId)))?.metadata?.difficulty).toBe(3);
  });
});
