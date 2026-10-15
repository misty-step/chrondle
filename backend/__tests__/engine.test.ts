import { defineSchema, defineTable, internalMutationGeneric, makeFunctionReference, mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { describe, expect, it } from "vitest";
import type { CommitInfo, ReadEntry } from "../src/engine/engine";
import { readsIntersect } from "../src/protocol/sync";
import { makeEngine } from "./support";

const schema = defineSchema({
  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),
  notes: defineTable({ text: v.string() }),
});

const modules = {
  counters: {
    create: mutationGeneric({ args: { name: v.string() }, handler: (ctx, { name }) => ctx.db.insert("counters", { name, value: 0 }) }),
    bumpBoth: mutationGeneric({
      args: { a: v.id("counters"), b: v.id("counters") },
      handler: async (ctx, { a, b }) => {
        const first = (await ctx.db.get(a))!;
        await ctx.db.patch(a, { value: first.value + 1 });
        const second = (await ctx.db.get(b))!;
        await ctx.db.patch(b, { value: second.value + 1 });
      },
    }),
    readBoth: queryGeneric({
      args: { a: v.id("counters"), b: v.id("counters") },
      handler: async (ctx, { a, b }) => {
        const first = (await ctx.db.get(a))!;
        for (let i = 0; i < 5; i++) await ctx.db.query("counters").withIndex("by_name").collect();
        const second = (await ctx.db.get(b))!;
        return [first.value, second.value];
      },
    }),
    byName: queryGeneric({
      args: { name: v.string() },
      handler: (ctx, { name }) => ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", name)).first(),
    }),
    set: mutationGeneric({ args: { id: v.id("counters"), value: v.number() }, handler: (ctx, { id, value }) => ctx.db.patch(id, { value }) }),
    insertInvalid: mutationGeneric({ args: {}, handler: (ctx) => ctx.db.insert("counters", { name: 7 } as never) }),
    outer: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        await ctx.db.insert("notes", { text: "outer" });
        await ctx.runMutation(makeFunctionReference<"mutation">("counters:innerFails"), {}).catch(() => undefined);
        return (await ctx.db.query("notes").collect()).map((note) => note.text);
      },
    }),
    innerFails: internalMutationGeneric({
      args: {},
      handler: async (ctx) => {
        await ctx.db.insert("notes", { text: "inner" });
        throw new Error("inner failed");
      },
    }),
    appError: mutationGeneric({
      args: {},
      handler: async () => {
        throw new ConvexError({ code: "LIMIT", remaining: 0 });
      },
    }),
    append: mutationGeneric({ args: { text: v.string() }, handler: (ctx, { text }) => ctx.db.insert("notes", { text }) }),
  },
};

const engineFor = (exposeErrors = false) => makeEngine(schema, modules, { exposeErrors });
const errorOf = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error);

describe("engine semantics", () => {
  it("rejects arguments that fail the function's validators before running it", async () => {
    const engine = engineFor();
    await expect(engine.runMutation("counters:create", { name: 5 }, null)).rejects.toThrow(/ArgumentValidationError/);
    expect([...engine.store.allDocuments("counters")]).toHaveLength(0);
  });

  it("rejects documents that violate the schema and writes nothing", async () => {
    const engine = engineFor();
    await expect(engine.runMutation("counters:insertInvalid", {}, null)).rejects.toThrow(/does not match/);
    expect([...engine.store.allDocuments("counters")]).toHaveLength(0);
  });

  it("rolls back a failed nested runMutation while keeping the caller's writes", async () => {
    const engine = engineFor();
    const { value } = await engine.runMutation("counters:outer", {}, null);
    expect(value).toEqual(["outer"]);
    expect([...engine.store.allDocuments("notes")].map((note) => note.text)).toEqual(["outer"]);
  });

  it("gives every query one committed state while mutations commit concurrently", async () => {
    const engine = engineFor();
    const a = (await engine.runMutation("counters:create", { name: "a" }, null)).value as string;
    const b = (await engine.runMutation("counters:create", { name: "b" }, null)).value as string;
    const reads: unknown[] = [];
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        i % 2 ? engine.runMutation("counters:bumpBoth", { a, b }, null) : engine.runQuery("counters:readBoth", { a, b }, null).then((pair) => reads.push(pair)),
      ),
    );
    expect(reads).toHaveLength(20);
    for (const [first, second] of reads as number[][]) expect(first).toBe(second);
    expect((await engine.runQuery("counters:readBoth", { a, b }, null)) as number[]).toEqual([20, 20]);
  });

  it("applies a replayed mutation (same session and request id) only once", async () => {
    const engine = engineFor();
    const dedupe = { session: "session-1", request: 0 };
    const first = await engine.runMutation("counters:append", { text: "once" }, null, { dedupe });
    const replay = await engine.runMutation("counters:append", { text: "once" }, null, { dedupe });
    expect(replay.value).toBe(first.value);
    expect(replay.ts).toBe(first.ts);
    expect([...engine.store.allDocuments("notes")]).toHaveLength(1);
  });

  it("redacts errors like Convex production but keeps ConvexError data", async () => {
    const engine = engineFor(false);
    const application = engine.clientError(await errorOf(engine.runMutation("counters:appError", {}, null)));
    expect(application.errorMessage).toMatch(/^\[Request ID: [0-9a-f]{16}\] Server Error$/);
    expect(application.errorData).toEqual({ code: "LIMIT", remaining: 0 });
    const missing = engine.clientError(await errorOf(engine.runQuery("counters:nope", {}, null)));
    expect(missing).toEqual({ errorMessage: expect.stringMatching(/^\[Request ID: [0-9a-f]{16}\] Server Error$/), errorData: undefined });
    const internal = engine.clientError(await errorOf(engine.runMutation("counters:innerFails", {}, null)));
    expect(internal.errorMessage).toMatch(/Server Error$/);
  });

  it("shows error messages in development mode, like a Convex dev deployment", async () => {
    const engine = engineFor(true);
    const failure = engine.clientError(await errorOf(engine.runMutation("counters:appError", {}, null)));
    expect(failure.errorMessage).toMatch(/Server Error\nUncaught ConvexError: /);
  });

  it("invalidates a subscription only when a commit touches what it read", async () => {
    const engine = engineFor();
    const a = (await engine.runMutation("counters:create", { name: "a" }, null)).value as string;
    const b = (await engine.runMutation("counters:create", { name: "b" }, null)).value as string;
    const commits: CommitInfo[] = [];
    engine.setCommitListener((commit) => commits.push(commit));
    const reads: ReadEntry[] = [];
    await engine.runQuery("counters:byName", { name: "a" }, null, { readSet: reads });

    await engine.runMutation("counters:set", { id: b, value: 5 }, null);
    await engine.runMutation("counters:set", { id: a, value: 5 }, null);
    await engine.runMutation("counters:create", { name: "a" }, null);
    expect(commits.map((commit) => readsIntersect(reads, commit.writes))).toEqual([false, true, true]);
  });
});
