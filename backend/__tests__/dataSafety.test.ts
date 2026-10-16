/** Fault injection at every maintenance boundary. No external services or private data. */
import {
  actionGeneric,
  defineSchema,
  defineTable,
  makeFunctionReference,
  mutationGeneric,
} from "convex/server";
import { v } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { parse, readState, restore, serialize, summarize } from "../src/engine/backup";
import { Engine, SYSTEM } from "../src/engine/engine";
import { INTERRUPTED, Scheduler } from "../src/engine/scheduler";
import { SCHEDULED_FUNCTIONS, type Sql } from "../src/engine/store";
import { memorySql } from "./sqlite";
import { makeEngine } from "./support";

const schema = defineSchema({
  notes: defineTable({ text: v.string() }),
  other: defineTable({ text: v.string() }),
});
const ref = makeFunctionReference<"mutation">("notes:add");
const modules = {
  notes: {
    add: mutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.db.insert("notes", { text }),
    }),
    later: mutationGeneric({
      args: {},
      handler: (ctx) => ctx.scheduler.runAfter(60_000, ref, { text: "queued" }),
    }),
  },
};
// Convex's runtime export is intentionally omitted from its public schema type.
const schemaExport = (schema as unknown as { export(): string }).export();
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const observed = <T>(promise: Promise<T>) =>
  Promise.race([
    promise.then((value) => ({ done: true as const, value })),
    delay(150).then(() => ({ done: false as const })),
  ]);
const snapshot = (engine: Engine) => parse([...serialize(readState(engine))]);
const everything = (engine: Engine) => ({
  summary: summarize(readState(engine)),
  registry: engine.store.registeredTables(),
  ts: engine.ts,
});
const outcome = (promise: Promise<unknown>) =>
  promise.then(
    () => "success",
    (error: Error) => error.message,
  );

async function seeded(sql: Sql = memorySql()) {
  const engine = new Engine({
    sql,
    schemaExport,
    modules,
  });
  await engine.runMutation("notes:add", { text: "accepted" }, null, {
    dedupe: { session: "synthetic", request: 1 },
  });
  await engine.runMutation("notes:later", {}, null);
  await engine.writeExclusive(SYSTEM, ({ setMeta }) => setMeta("cron:sample", "1000"));
  engine.fence();
  return engine;
}

/** One-shot SQL fault, including failures after earlier statements have executed. */
function faultySql() {
  const underlying = memorySql();
  let fail: ((query: string) => boolean) | null = null;
  const sql: Sql = {
    exec(query, ...params) {
      if (fail?.(query)) {
        fail = null;
        throw new Error("injected storage crash");
      }
      return underlying.exec(query, ...params);
    },
    transaction: (fn) => underlying.transaction(fn),
  };
  return { sql, arm: (predicate: (query: string) => boolean) => (fail = predicate) };
}

describe("verified atomic replacement", () => {
  it.each(["documents", "registry", "jobs", "cursors", "replay"] as const)(
    "rejects a recorded %s checksum mismatch without replacing anything",
    async (part) => {
      const source = await seeded();
      const recorded = summarize(readState(source));
      const corrupted = snapshot(source);
      switch (part) {
        case "documents":
          corrupted.documents.get("notes")![0].text = "corrupt";
          break;
        case "registry":
          corrupted.tableNumbers.set("other", 12000);
          break;
        case "jobs":
          corrupted.scheduledFunctions[0].scheduledTime = 1;
          break;
        case "cursors":
          corrupted.cronCursors.set("sample", 2000);
          break;
        case "replay":
          corrupted.mutationLog[0].result = "null";
          break;
      }
      const target = await seeded();
      const before = everything(target);
      await expect(restore(target, corrupted, recorded)).rejects.toThrow(/checksum|mismatch/i);
      expect(everything(target)).toEqual(before);
    },
  );

  it("rolls back a post-write verification mismatch too, including registry caches", async () => {
    const source = await seeded();
    const target = await seeded();
    const before = everything(target);
    const apply = target.store.applyWrite.bind(target.store);
    vi.spyOn(target.store, "applyWrite").mockImplementation((table, old, next) =>
      apply(table, old, next && table === "notes" ? { ...next, text: "injected corruption" } : next),
    );
    await expect(restore(target, snapshot(source))).rejects.toThrow(/checksum|mismatch/i);
    expect(everything(target)).toEqual(before);
    vi.restoreAllMocks();
    expect(await restore(target, snapshot(source))).toEqual(summarize(readState(source)));
  });

  it.each([
    "INSERT INTO cvx_documents",
    "DELETE FROM cvx_tables",
    "DELETE FROM cvx_meta",
    "DELETE FROM cvx_mutation_log",
    "INSERT INTO cvx_meta",
  ])("rolls back replacement after a fault at %s and recovers its queue", async (statement) => {
    const source = await seeded();
    const storage = faultySql();
    const target = await seeded(storage.sql);
    const before = everything(target);
    storage.arm((query) => query.startsWith(statement));
    await expect(restore(target, snapshot(source))).rejects.toThrow(/injected storage crash/);
    expect(everything(target)).toEqual(before);
    // Same retained SQLite on restart, and the failed operation did not poison the queue.
    const restarted = new Engine({ sql: storage.sql, schemaExport, modules });
    expect(everything(restarted)).toEqual(before);
    expect(restarted.writeMode).toBe("paused");
    expect(await restore(target, snapshot(source))).toEqual(summarize(readState(source)));
    await target.resume();
    await target.runMutation("notes:add", { text: "after recovery" }, null);
    expect(target.store.countTable("notes")).toBe(2);
  });
});

describe("bounded drain and fenced queue", () => {
  it("a retried pause persists the barrier after the first persistence call failed", async () => {
    const storage = faultySql();
    const engine = await seeded(storage.sql);
    await engine.resume();
    const scheduler = new Scheduler(engine, []);
    storage.arm((query) => query.startsWith("INSERT INTO cvx_meta"));
    await expect(scheduler.pause(Date.now() + 25)).rejects.toThrow(/injected storage crash/);
    expect(engine.writeMode).toBe("paused");
    expect(engine.store.getMeta("writesPaused")).toBe("0");
    expect(await scheduler.pause(Date.now() + 25)).toMatchObject({ settled: true });
    expect(new Engine({ sql: storage.sql, schemaExport, modules }).writeMode).toBe("paused");
  });

  it("a commit waiting on a stuck reader cannot strand maintenance after the deadline", async () => {
    const entered = gate();
    const finish = gate();
    const engine = makeEngine(schema, modules);
    const before = snapshot(engine);
    const reader = outcome(engine.snapshot(async () => { entered.release(); await finish.promise; }));
    await entered.promise;
    const mutation = outcome(engine.runMutation("notes:add", { text: "not committed" }, null));
    await delay(10); // the handler has finished; commit is waiting for the snapshot reader
    const paused = await new Scheduler(engine, []).pause(Date.now() + 25);
    const restoring = restore(engine, before);
    const bounded = await observed(restoring);
    finish.release();
    await Promise.all([reader, mutation, restoring]);
    expect(paused.settled).toBe(false);
    expect(bounded.done).toBe(true);
    expect(engine.store.countTable("notes")).toBe(0);
    await engine.resume();
    await engine.runMutation("notes:add", { text: "after reader recovery" }, null);
    expect(engine.store.countTable("notes")).toBe(1);
  });

  it("the deadline bounds a due action first started by pause, including its later syscalls", async () => {
    const entered = gate();
    const finish = gate();
    const attempts: string[] = [];
    const engine = makeEngine(schema, {
      ...modules,
      jobs: {
        long: actionGeneric({
          args: {},
          handler: async (ctx) => {
            entered.release();
            await finish.promise;
            attempts.push(await outcome(ctx.runMutation(ref, { text: "stale" })));
            attempts.push(await outcome(ctx.scheduler.runAfter(0, ref, { text: "stale job" })));
          },
        }),
        enqueue: mutationGeneric({
          args: {},
          handler: (ctx) =>
            ctx.scheduler.runAfter(0, makeFunctionReference<"action">("jobs:long"), {}),
        }),
      },
    });
    const scheduler = new Scheduler(engine, []);
    await engine.runMutation("jobs:enqueue", {}, null);
    const pausing = scheduler.pause(Date.now() + 25);
    await entered.promise;
    const bounded = await observed(pausing);
    const atDeadline = everything(engine);
    const mode = engine.writeMode;
    await engine.resume();
    finish.release();
    await delay(20);
    expect(bounded.done).toBe(true);
    if (bounded.done) expect(bounded.value.settled).toBe(false);
    expect(mode).toBe("paused");
    expect([...engine.store.allDocuments(SCHEDULED_FUNCTIONS)][0].state).toEqual({
      kind: "failed",
      error: INTERRUPTED,
    });
    expect(attempts).toHaveLength(2);
    expect(attempts.every((message) => /paused/.test(message))).toBe(true);
    expect(everything(engine)).toEqual(atDeadline);
  });

  it.each([false, true])(
    "a fenced mutation releases restore/resume and cannot register a table (resume=%s)",
    async (resume) => {
      const entered = gate();
      const finish = gate();
      let attempted = false;
      const engine = makeEngine(schema, {
        ...modules,
        jobs: {
          long: mutationGeneric({
            args: {},
            handler: async (ctx) => {
              entered.release();
              await finish.promise;
              try {
                return await ctx.db.insert("other", { text: "cut off" });
              } finally {
                attempted = true;
              }
            },
          }),
        },
      });
      const before = snapshot(engine);
      const running = outcome(engine.runMutation("jobs:long", {}, null));
      await entered.promise;
      const report = await new Scheduler(engine, []).pause(Date.now() + 25);
      const restoring = restore(engine, before);
      const restoredBeforeRelease = await observed(restoring);
      const resuming = resume ? engine.resume() : Promise.resolve();
      const resumedBeforeRelease = await observed(resuming);
      finish.release();
      await running;
      await restoring;
      await resuming;
      const stable = everything(engine);
      await delay(20);
      expect(report.settled).toBe(false);
      expect(restoredBeforeRelease.done).toBe(true);
      expect(resumedBeforeRelease.done).toBe(true);
      expect(attempted).toBe(true);
      expect(engine.store.registeredTables().has("other")).toBe(false);
      expect(everything(engine)).toEqual(stable);
      await engine.resume();
      await engine.runMutation("notes:add", { text: "fresh" }, null);
      expect(engine.store.countTable("notes")).toBe(1);
    },
  );

  it("does not admit an old queued client request into the next live epoch", async () => {
    const entered = gate();
    const finish = gate();
    const engine = makeEngine(schema, {
      ...modules,
      jobs: {
        long: mutationGeneric({ args: {}, handler: async () => { entered.release(); await finish.promise; } }),
      },
    });
    const old = outcome(engine.runMutation("jobs:long", {}, null));
    await entered.promise;
    const queued = outcome(engine.runMutation("notes:add", { text: "old queued request" }, null));
    await new Scheduler(engine, []).pause(Date.now() + 25);
    const resuming = engine.resume();
    const beforeRelease = await observed(resuming);
    finish.release();
    await old;
    const queuedResult = await queued;
    await resuming;
    expect(beforeRelease.done).toBe(true);
    expect(queuedResult).toMatch(/paused/);
    expect(engine.store.countTable("notes")).toBe(0);
  });

  it.each(["drain", "fence", "resume"] as const)(
    "a storage failure in %s fails closed and can be retried",
    async (path) => {
      const storage = faultySql();
      const engine = await seeded(storage.sql);
      await engine.resume();
      if (path === "fence") engine.beginDrain();
      if (path === "resume") engine.fence();
      storage.arm((query) => query.startsWith("INSERT INTO cvx_meta"));
      const operation = async () => {
        if (path === "drain") engine.beginDrain();
        else if (path === "fence") engine.fence();
        else await engine.resume();
      };
      await expect(operation()).rejects.toThrow(/injected storage crash/);
      expect(engine.writeMode).toBe("paused");
      await expect(engine.runMutation("notes:add", { text: "unsafe" }, null)).rejects.toThrow(/paused/);
      engine.fence(); // retry persistence before acknowledging a pause
      expect(new Engine({ sql: storage.sql, schemaExport, modules }).writeMode).toBe("paused");
      await engine.resume();
      await engine.runMutation("notes:add", { text: "recovered" }, null);
      expect(engine.store.countTable("notes")).toBe(2);
    },
  );
});

describe("table registration is part of the authorized transaction", () => {
  it("an expired allocation cannot race an imported registry or a new writer", async () => {
    const entered = gate();
    const finish = gate();
    let late = "";
    const engine = makeEngine(schema, {
      ...modules,
      jobs: {
        staged: mutationGeneric({
          args: {},
          handler: async (ctx) => {
            await ctx.db.insert("other", { text: "staged at old table number" });
            entered.release();
            await finish.promise;
            late = await outcome(ctx.db.insert("other", { text: "late allocation" }));
          },
        }),
      },
    });
    const running = outcome(engine.runMutation("jobs:staged", {}, null));
    await entered.promise;
    await new Scheduler(engine, []).pause(Date.now() + 25);
    const imported = snapshot(engine);
    imported.tableNumbers.set("notes", 10001); // deliberately reuse the fenced allocation
    const restoring = restore(engine, imported);
    const bounded = await observed(restoring);
    // Avoid deadlocking an intentionally broken baseline: always release the handler.
    if (bounded.done) {
      await engine.resume();
      await engine.runMutation("notes:add", { text: "accepted new writer" }, null);
    }
    const beforeRelease = everything(engine);
    finish.release();
    await running;
    await restoring;
    await delay(20);
    expect(bounded.done).toBe(true);
    expect(late).toMatch(/paused/);
    expect(everything(engine)).toEqual(beforeRelease);
    expect(engine.store.tableOf([...engine.store.allDocuments("notes")][0]._id)).toBe("notes");
    expect(engine.store.registeredTables().has("other")).toBe(false);
  });

  it.each(["function", "storage", "nested"] as const)(
    "a %s failure cannot leave a numbered empty table",
    async (failure) => {
      const storage = faultySql();
      const engine = new Engine({
        sql: storage.sql,
        schemaExport,
        modules: {
          ...modules,
          jobs: {
            insert: mutationGeneric({
              args: {},
              handler: async (ctx) => {
                await ctx.db.insert("other", { text: "uncommitted" });
                if (failure !== "storage") throw new Error("injected function failure");
              },
            }),
            parent: mutationGeneric({
              args: {},
              handler: async (ctx) => {
                await ctx.runMutation(makeFunctionReference<"mutation">("jobs:insert"), {}).catch(() => undefined);
                return ctx.db.insert("notes", { text: "parent accepted" });
              },
            }),
          },
        },
      });
      const before = everything(engine);
      if (failure === "storage") storage.arm((query) => query.startsWith("INSERT INTO cvx_mutation_log"));
      const request = engine.runMutation(failure === "nested" ? "jobs:parent" : "jobs:insert", {}, null, {
        dedupe: { session: "registry-test", request: 1 },
      });
      if (failure === "nested") await request;
      else await expect(request).rejects.toThrow(/injected/);
      expect(engine.store.registeredTables().has("other")).toBe(false);
      if (failure !== "nested") expect(everything(engine)).toEqual(before);
      await engine.runMutation("notes:add", { text: "new allocation" }, null);
      expect(engine.store.registeredTables().get("notes")).toBe(10001);
    },
  );
});
