import { defineSchema, defineTable, mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import { exportLines, restore, summarize, summarizeDocuments } from "../src/engine/backup";
import { decodeDocumentId } from "../src/engine/ids";
import { makeEngine } from "./support";

const schema = defineSchema({
  users: defineTable({ name: v.string(), tags: v.optional(v.array(v.string())) }),
  plays: defineTable({ userId: v.id("users"), score: v.number() }),
  emptied: defineTable({ text: v.string() }),
});

const modules = {
  seed: {
    run: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        const ada = await ctx.db.insert("users", { name: "Ada", tags: ["x"] });
        await ctx.db.insert("users", { name: "Grace" });
        await ctx.db.insert("plays", { userId: ada, score: 3 });
        await ctx.db.delete(await ctx.db.insert("emptied", { text: "gone" }));
      },
    }),
    addEmptied: mutationGeneric({ args: {}, handler: (ctx) => ctx.db.insert("emptied", { text: "new" }) }),
    addUser: mutationGeneric({ args: { name: v.string() }, handler: (ctx, { name }) => ctx.db.insert("users", { name }) }),
  },
};

async function seeded() {
  const engine = makeEngine(schema, modules);
  await engine.runMutation("seed:run", {}, null);
  return engine;
}

describe("backup and restore", () => {
  it("restores an exact copy: same documents, IDs, creation times, checksums and table numbers", async () => {
    const source = await seeded();
    const lines = [...exportLines(source)];
    const target = makeEngine(schema, modules);
    const manifest = await restore(target, lines);

    expect(manifest).toEqual(summarize(source));
    expect(manifest.users.count).toBe(2);
    expect(manifest.emptied).toMatchObject({ count: 0, tableNumber: source.store.registeredTables().get("emptied") });
    expect([...target.store.allDocuments("users")]).toEqual([...source.store.allDocuments("users")]);

    // IDs minted after a restore still belong to the table number Convex assigned.
    const minted = (await target.runMutation("seed:addEmptied", {}, null)).value as string;
    expect(decodeDocumentId(minted)?.tableNumber).toBe(source.store.registeredTables().get("emptied"));
  });

  it("replaces everything: documents and tables absent from the backup are removed", async () => {
    const source = await seeded();
    const target = await seeded();
    await target.runMutation("seed:addUser", { name: "Extra" }, null);
    const manifest = await restore(target, [...exportLines(source)].filter((line) => !line.includes('"plays"')));
    expect(manifest.users).toEqual(summarize(source).users);
    expect(manifest.plays.count).toBe(0);
  });

  it("rejects a backup with an invalid document and leaves data untouched", async () => {
    const source = await seeded();
    const target = await seeded();
    const before = summarize(target);
    const corrupted = [...exportLines(source)].map((line) => line.replace('"name":"Grace"', '"name":42'));
    await expect(restore(target, corrupted)).rejects.toThrow(/does not match/);
    expect(summarize(target)).toEqual(before);
  });

  it("hashes canonical records independent of field order", () => {
    const a = summarizeDocuments(1, [{ _id: "x", b: 1, a: [1, { d: 2, c: 3 }] }]);
    const b = summarizeDocuments(1, [{ a: [1, { c: 3, d: 2 }], _id: "x", b: 1 }]);
    expect(a).toEqual(b);
    expect(a.sha256).not.toBe(summarizeDocuments(1, [{ _id: "x", b: 2, a: [1, { c: 3, d: 2 }] }]).sha256);
  });
});
