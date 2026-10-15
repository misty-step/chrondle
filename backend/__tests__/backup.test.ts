import {
  defineSchema,
  defineTable,
  internalActionGeneric,
  internalMutationGeneric,
  makeFunctionReference,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import {
  mismatches,
  parse,
  readState,
  restore,
  serialize,
  summarize,
  summarizeDocuments,
} from "../src/engine/backup";
import type { Engine } from "../src/engine/engine";
import { decodeDocumentId } from "../src/engine/ids";
import { INTERRUPTED, Scheduler } from "../src/engine/scheduler";
import { SCHEDULED_FUNCTIONS } from "../src/engine/store";
import { makeEngine } from "./support";

const schema = defineSchema({
  users: defineTable({ name: v.string(), tags: v.optional(v.array(v.string())) }),
  plays: defineTable({ userId: v.id("users"), score: v.number() }),
  emptied: defineTable({ text: v.string() }),
  notes: defineTable({ text: v.string() }),
});

const note = makeFunctionReference<"mutation">("seed:note");

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
    addEmptied: mutationGeneric({
      args: {},
      handler: (ctx) => ctx.db.insert("emptied", { text: "new" }),
    }),
    names: queryGeneric({
      args: {},
      handler: async (ctx) => (await ctx.db.query("users").collect()).map((user) => user.name),
    }),
    addUser: mutationGeneric({
      args: { name: v.string() },
      handler: (ctx, { name }) => ctx.db.insert("users", { name }),
    }),
    later: mutationGeneric({
      args: { text: v.string(), delayMs: v.number() },
      handler: (ctx, { text, delayMs }) => ctx.scheduler.runAfter(delayMs, note, { text }),
    }),
    note: internalMutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.db.insert("notes", { text }),
    }),
    enrich: internalActionGeneric({
      args: {},
      handler: (ctx) => ctx.runMutation(note, { text: "enriched" }),
    }),
    enrichLater: mutationGeneric({
      args: {},
      handler: (ctx) =>
        ctx.scheduler.runAfter(0, makeFunctionReference<"action">("seed:enrich"), {}),
    }),
  },
};

async function seeded() {
  const engine = makeEngine(schema, modules);
  await engine.runMutation("seed:run", {}, null);
  return engine;
}

/** A paused copy of `engine`'s state as snapshot lines, like GET /export. */
function exported(engine: Engine): string[] {
  return [...serialize(readState(engine))].join("").split("\n");
}

/** A fresh, paused backend, like a new production database. */
function emptyTarget() {
  const engine = makeEngine(schema, modules);
  engine.pauseIfNew();
  return engine;
}

const everything = (engine: Engine) => ({
  summary: summarize(readState(engine)),
  registry: [...engine.store.registeredTables()],
  lines: exported(engine),
});

describe("snapshots and restore", () => {
  it("restores an exact copy: same documents, IDs, creation times, checksums and table numbers", async () => {
    const source = await seeded();
    const target = emptyTarget();
    const stored = await restore(target, parse(exported(source)));

    expect(stored).toEqual(summarize(readState(source)));
    expect(stored.manifest.users.count).toBe(2);
    expect(stored.manifest.emptied).toMatchObject({
      count: 0,
      tableNumber: source.store.registeredTables().get("emptied"),
    });
    expect([...target.store.allDocuments("users")]).toEqual([
      ...source.store.allDocuments("users"),
    ]);

    // IDs minted after a restore still belong to the table number Convex assigned.
    await target.resume();
    const minted = (await target.runMutation("seed:addEmptied", {}, null)).value as string;
    expect(decodeDocumentId(minted)?.tableNumber).toBe(
      source.store.registeredTables().get("emptied"),
    );
  });

  it("replaces everything: documents and tables absent from the snapshot are removed", async () => {
    const source = await seeded();
    const target = await seeded();
    await target.runMutation("seed:addUser", { name: "Extra" }, null);
    target.fence();
    const stored = await restore(
      target,
      parse(exported(source).filter((line) => !line.includes('"plays"'))),
    );
    expect(stored.manifest.users).toEqual(summarize(readState(source)).manifest.users);
    expect(stored.manifest.plays).toBeUndefined();
    expect(target.store.countTable("plays")).toBe(0);
  });

  it("refuses to restore while writes are live, changing nothing", async () => {
    const source = await seeded();
    const target = await seeded();
    const before = everything(target);
    await expect(restore(target, parse(exported(source)))).rejects.toThrow(/Pause writes first/);
    expect(everything(target)).toEqual(before);
  });

  it("rejects a snapshot with an invalid document and leaves everything untouched", async () => {
    const source = await seeded();
    const target = await seeded();
    target.fence();
    const before = everything(target);
    const corrupted = exported(source).map((line) => line.replace('"name":"Grace"', '"name":42'));
    await expect(restore(target, parse(corrupted))).rejects.toThrow(/does not match/);
    expect(everything(target)).toEqual(before);
  });

  it("rejects conflicting table numbers without registering any of them", async () => {
    // The review's probe: notes=10001 and later=10001 must not leave notes numbered.
    const target = emptyTarget();
    const before = everything(target);
    expect(() =>
      parse([
        JSON.stringify({ table: "notes", tableNumber: 10001 }),
        JSON.stringify({ table: "later", tableNumber: 10001 }),
      ]),
    ).toThrow(/given to both/);
    expect(() => parse([JSON.stringify({ table: "notes", tableNumber: 9 })])).toThrow(
      /invalid number/,
    );
    expect(() => parse([JSON.stringify({ surprise: true })])).toThrow(/Unknown snapshot record/);
    // A document whose ID says another table, after a valid number line.
    const source = await seeded();
    const numbers = source.store.registeredTables();
    const userLine = exported(source).find((line) =>
      line.startsWith('{"table":"users","document"'),
    )!;
    expect(() =>
      parse([
        JSON.stringify({ table: "plays", tableNumber: numbers.get("plays") }),
        userLine.replace('"users"', '"plays"'),
      ]),
    ).toThrow(/listed with numbers/);
    // Valid lines, but a schema-invalid document: refused after staging, before storing.
    const invalid = exported(source).map((line) => line.replace('"score":3', '"score":"three"'));
    await expect(restore(target, parse(invalid))).rejects.toThrow(/does not match/);
    expect(everything(target)).toEqual(before);
    expect(target.store.registeredTables().get("notes")).toBeUndefined();

    // The corrected import then succeeds with the numbers it declares.
    const stored = await restore(target, parse(exported(source)));
    expect(mismatches(summarize(readState(source)), stored)).toEqual([]);
  });

  it("restores the recorded creation time of a document whose ID already exists", async () => {
    // Found by verify-backend: a re-queued job kept its old _creationTime while its
    // creation-time index entry took the new one, and the import failed verification.
    const engine = await seeded();
    const lines = exported(engine);
    const index = lines.findIndex((line) => line.includes('"name":"Grace"'));
    const grace = JSON.parse(lines[index]);
    lines[index] = JSON.stringify({ ...grace, document: { ...grace.document, _creationTime: 1 } });
    engine.fence();
    const snapshot = parse(lines);
    const stored = await restore(engine, snapshot);
    expect(mismatches(summarize(snapshot), stored)).toEqual([]);
    expect(engine.store.getCommitted(grace.document._id)?._creationTime).toBe(1);
    // Queries order by creation time: the index agrees with the stored row.
    expect(await engine.runQuery("seed:names", {}, null)).toEqual(["Grace", "Ada"]);
  });

  it("hashes canonical records independent of field order", () => {
    const a = summarizeDocuments(1, [{ _id: "x", b: 1, a: [1, { d: 2, c: 3 }] }]);
    const b = summarizeDocuments(1, [{ a: [1, { c: 3, d: 2 }], _id: "x", b: 1 }]);
    expect(a).toEqual(b);
    expect(a.sha256).not.toBe(
      summarizeDocuments(1, [{ _id: "x", b: 2, a: [1, { c: 3, d: 2 }] }]).sha256,
    );
  });
});

describe("restoring runtime state with the data", () => {
  it("carries pending jobs, cron cursors and replay records, and delivers the job once", async () => {
    // The review's probe: a committed scheduled mutation must survive export → import.
    const source = await seeded();
    const replay = { session: "client-1", request: 7 };
    await source.runMutation("seed:addUser", { name: "Replayed" }, null, { dedupe: replay });
    await source.runMutation("seed:later", { text: "queued", delayMs: 0 }, null);
    source.store.setMeta("cron:sample", "1792022400000");
    source.fence();
    const snapshot = parse(exported(source));
    expect(summarize(snapshot).runtime).toMatchObject({
      scheduledFunctions: { count: 1, states: { pending: 1 } },
      cronCursors: { sample: 1792022400000 },
      mutationLog: { count: 1 },
    });

    const target = emptyTarget();
    const stored = await restore(target, snapshot);
    expect(mismatches(summarize(snapshot), stored)).toEqual([]);
    await target.resume();
    // The client retrying its acknowledged mutation gets the original result, no second user.
    const again = await target.runMutation("seed:addUser", { name: "Replayed" }, null, {
      dedupe: replay,
    });
    expect(target.store.getCommitted(again.value as string)?.name).toBe("Replayed");
    expect(target.store.countTable("users")).toBe(3);

    const scheduler = new Scheduler(target, []);
    await scheduler.runDue();
    await scheduler.runDue();
    expect([...target.store.allDocuments("notes")].map((n) => n.text)).toEqual(["queued"]);
    expect([...target.store.allDocuments(SCHEDULED_FUNCTIONS)].map((job) => job.state)).toEqual([
      { kind: "success" },
    ]);

    // The finished job travels on unchanged: a second export restores exactly elsewhere.
    target.fence();
    const finished = parse(exported(target));
    expect(summarize(finished).runtime.scheduledFunctions.states).toEqual({ success: 1 });
    expect(mismatches(summarize(finished), await restore(emptyTarget(), finished))).toEqual([]);
  });

  it("restoring an older snapshot drops later jobs and replay records", async () => {
    // The review's probes: a job queued after the backup must not run against it, and a
    // client must not be told a write absent from the restored data succeeded.
    const engine = await seeded();
    const older = parse(exported(engine));
    const replay = { session: "client-2", request: 0 };
    const first = await engine.runMutation("seed:addUser", { name: "After" }, null, {
      dedupe: replay,
    });
    await engine.runMutation("seed:later", { text: "stale", delayMs: 0 }, null);
    engine.fence();
    const stored = await restore(engine, older);
    expect(mismatches(summarize(older), stored)).toEqual([]);
    expect(stored.runtime.scheduledFunctions.count).toBe(0);
    expect(stored.runtime.mutationLog.count).toBe(0);

    await engine.resume();
    await new Scheduler(engine, []).runDue();
    expect(engine.store.countTable("notes")).toBe(0);
    const retried = await engine.runMutation("seed:addUser", { name: "After" }, null, {
      dedupe: replay,
    });
    expect(retried.value).not.toBe(first.value);
    expect(engine.store.getCommitted(retried.value as string)?.name).toBe("After");
  });

  it("fails an action that was running when a live backup was taken, rather than running it", async () => {
    const engine = await seeded();
    await engine.runMutation("seed:enrichLater", {}, null);
    const [job] = [...engine.store.allDocuments(SCHEDULED_FUNCTIONS)];
    // Recorded mid-run, as a 03:17 backup can catch a long action.
    const running = exported(engine).map((line) =>
      line.includes(job._id) ? line.replace('"kind":"pending"', '"kind":"inProgress"') : line,
    );
    const target = emptyTarget();
    await restore(target, parse(running));
    await target.resume();
    const scheduler = new Scheduler(target, []);
    await scheduler.runDue();
    expect([...target.store.allDocuments(SCHEDULED_FUNCTIONS)].map((j) => j.state)).toEqual([
      { kind: "failed", error: INTERRUPTED },
    ]);
    expect(target.store.countTable("notes")).toBe(0);
  });
});
