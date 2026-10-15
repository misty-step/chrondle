/**
 * Pausing writes as a barrier (the review of #328): what is admitted before a
 * pause settles or is cut off, nothing lands after it, and imports, restores
 * and connected clients stay coherent across it.
 */
import { ConvexClient } from "convex/browser";
import {
  actionGeneric,
  anyApi,
  defineSchema,
  defineTable,
  internalMutationGeneric,
  makeFunctionReference,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse, readState, restore, serialize, summarize } from "../src/engine/backup";
import type { Engine } from "../src/engine/engine";
import { INTERRUPTED, parseCrons, Scheduler } from "../src/engine/scheduler";
import { SCHEDULED_FUNCTIONS } from "../src/engine/store";
import { eventually, InProcessServer, makeEngine, syntheticIssuer } from "./support";

const schema = defineSchema({ notes: defineTable({ text: v.string() }) });
const work = makeFunctionReference<"mutation">("notes:work");

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}

/** Gates the tests drive; reset per test. */
let gates = { entered: gate(), finish: gate() };

const modules = {
  notes: {
    add: mutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.db.insert("notes", { text }),
    }),
    addSlowly: mutationGeneric({
      args: { text: v.string() },
      handler: async (ctx, { text }) => {
        const id = await ctx.db.insert("notes", { text });
        gates.entered.release();
        await gates.finish.promise;
        return id;
      },
    }),
    list: queryGeneric({
      args: {},
      handler: async (ctx) => (await ctx.db.query("notes").collect()).map((note) => note.text),
    }),
    work: internalMutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.db.insert("notes", { text }),
    }),
    later: mutationGeneric({
      args: { text: v.string(), delayMs: v.number() },
      handler: (ctx, { text, delayMs }) => ctx.scheduler.runAfter(delayMs, work, { text }),
    }),
    /** Waits, then writes and schedules: an action admitted before a pause. */
    slowAction: actionGeneric({
      args: {},
      handler: async (ctx) => {
        gates.entered.release();
        await gates.finish.promise;
        await ctx.runMutation(work, { text: "written by the action" });
        await ctx.scheduler.runAfter(0, work, { text: "scheduled by the action" });
      },
    }),
    enqueueSlowAction: mutationGeneric({
      args: {},
      handler: (ctx) =>
        ctx.scheduler.runAfter(0, makeFunctionReference<"action">("notes:slowAction"), {}),
    }),
  },
};

afterEach(() => {
  vi.useRealTimers();
  gates = { entered: gate(), finish: gate() };
});

const settledOutcome = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: Error) => ({ ok: false as const, error: error.message }),
  );
const texts = (engine: Engine) =>
  [...engine.store.allDocuments("notes")]
    .sort((a, b) => a._creationTime - b._creationTime)
    .map((note) => note.text);
const exported = (engine: Engine) => [...serialize(readState(engine))].join("");
const jobs = (engine: Engine) =>
  [...engine.store.allDocuments(SCHEDULED_FUNCTIONS)].map((job) => ({
    name: job.name,
    state: job.state,
  }));

describe("pause is a barrier", () => {
  it("waits for a mutation already running, refuses new work, and nothing lands after it", async () => {
    const engine = makeEngine(schema, modules);
    const scheduler = new Scheduler(engine, []);
    const running = engine.runMutation("notes:addSlowly", { text: "admitted" }, null);
    await gates.entered.promise;

    let acknowledged = false;
    const pausing = scheduler.pause(Date.now() + 10_000).then((report) => {
      acknowledged = true;
      return report;
    });
    const lateMutation = settledOutcome(engine.runMutation("notes:add", { text: "late" }, null));
    expect(engine.writeMode).toBe("draining");
    await expect(engine.runAction("notes:slowAction", {}, null)).rejects.toThrow(/paused/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(acknowledged).toBe(false);

    gates.finish.release();
    await running;
    expect(await pausing).toEqual({ settled: true, interrupted: [] });
    expect(engine.writeMode).toBe("paused");
    expect(await lateMutation).toEqual({ ok: false, error: expect.stringMatching(/paused/) });
    // The export taken at the acknowledgement already holds the admitted write…
    const atPause = exported(engine);
    expect(texts(engine)).toEqual(["admitted"]);
    // …and nothing written afterwards can make it stale.
    await expect(engine.runMutation("notes:add", { text: "after" }, null)).rejects.toThrow(
      /paused/,
    );
    await scheduler.runDue();
    expect(exported(engine)).toBe(atPause);
  });

  it("lets a running action finish and runs the job it scheduled before acknowledging", async () => {
    const engine = makeEngine(schema, modules);
    const scheduler = new Scheduler(engine, []);
    const action = engine.runAction("notes:slowAction", {}, null);
    await gates.entered.promise;
    const pausing = scheduler.pause(Date.now() + 10_000);
    gates.finish.release();
    await action;
    expect(await pausing).toEqual({ settled: true, interrupted: [] });
    // Settled: the action's write and the job it scheduled both landed before the barrier.
    expect(texts(engine)).toEqual(["written by the action", "scheduled by the action"]);
    expect(jobs(engine)).toEqual([{ name: "notes:work", state: { kind: "success" } }]);
    expect(summarize(readState(engine)).runtime.scheduledFunctions.states).toEqual({ success: 1 });
  });

  it("cuts off work still running at the deadline for good, even after resuming", async () => {
    const engine = makeEngine(schema, modules);
    const scheduler = new Scheduler(engine, []);
    await engine.runMutation("notes:enqueueSlowAction", {}, null);
    const draining = scheduler.runDue(); // starts the scheduled action, which then waits
    await gates.entered.promise;
    const [job] = [...engine.store.allDocuments(SCHEDULED_FUNCTIONS)];
    expect(job.state).toEqual({ kind: "inProgress" });

    const report = await scheduler.pause(Date.now() + 50);
    expect(report).toEqual({ settled: false, interrupted: [job._id] });
    const atPause = exported(engine);
    await engine.resume();
    gates.finish.release(); // the cut-off action now tries to write and to schedule
    await draining;
    expect(texts(engine)).toEqual([]);
    expect(jobs(engine)).toEqual([
      { name: "notes:slowAction", state: { kind: "failed", error: INTERRUPTED } },
    ]);
    expect(exported(engine)).toBe(atPause);
    // Work admitted after the resume writes normally.
    await engine.runMutation("notes:add", { text: "fresh" }, null);
    expect(texts(engine)).toEqual(["fresh"]);
  });

  it("starts no job, cron or pruning while paused and arms no wake-up", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-10-14T23:59:00Z") });
    const engine = makeEngine(schema, modules);
    const crons = parseCrons({
      default: {
        crons: {
          midnight: {
            name: "notes:work",
            args: [{ text: "midnight" }],
            schedule: { type: "daily", hourUTC: 0, minuteUTC: 0 },
          },
        },
      } as never,
    });
    const scheduler = new Scheduler(engine, crons);
    await scheduler.runDue(); // boots the cron's cursor
    await engine.runMutation("notes:later", { text: "old", delayMs: 0 }, null);
    await scheduler.runDue();
    await engine.runMutation("notes:later", { text: "queued", delayMs: 0 }, null);
    expect(await scheduler.pause(Date.now())).toMatchObject({ interrupted: [] });
    const atPause = exported(engine);

    vi.setSystemTime(Date.parse("2026-10-23T00:05:00Z")); // a cron is due, the old job prunable
    await scheduler.runDue();
    expect(await scheduler.prune()).toBe(0);
    expect(scheduler.nextWakeTime()).toBeNull();
    expect(exported(engine)).toBe(atPause);
    expect(texts(engine)).toEqual(["old"]);

    await engine.resume();
    expect(scheduler.nextWakeTime()).toBeLessThanOrEqual(Date.now());
    await scheduler.runDue();
    await scheduler.runDue();
    expect(texts(engine)).toEqual(["old", "queued", "midnight"]);
  });
});

describe("one writer across a migration", () => {
  it("moves queued work to the new backend, which delivers it once at its time", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-10-15T12:00:00Z") });
    const source = makeEngine(schema, modules);
    const sourceScheduler = new Scheduler(source, []);
    await source.runMutation("notes:add", { text: "accepted" }, null);
    await source.runMutation("notes:later", { text: "in a minute", delayMs: 60_000 }, null);
    expect(await sourceScheduler.pause(Date.now() + 1000)).toEqual({
      settled: true,
      interrupted: [],
    });
    const snapshot = parse(exported(source).split("\n"));
    expect(summarize(snapshot).runtime.scheduledFunctions.states).toEqual({ pending: 1 });

    const target = makeEngine(schema, modules);
    target.pauseIfNew();
    await restore(target, snapshot);
    await target.resume();
    const targetScheduler = new Scheduler(target, []);
    await targetScheduler.runDue();
    expect(texts(target)).toEqual(["accepted"]);

    vi.setSystemTime(Date.now() + 60_000);
    await sourceScheduler.runDue(); // the paused source never runs it
    await targetScheduler.runDue();
    await targetScheduler.runDue();
    expect(texts(target)).toEqual(["accepted", "in a minute"]);
    expect(texts(source)).toEqual(["accepted"]);
  });

  it("keeps connected clients coherent across a restore and a resume", async () => {
    const issuer = await syntheticIssuer();
    const engine = makeEngine(schema, modules);
    const scheduler = new Scheduler(engine, []);
    const server = new InProcessServer(engine, issuer.verifier());
    const client = new ConvexClient("https://backend.chrondle.test", {
      webSocketConstructor: server.WebSocket,
      unsavedChangesWarning: false,
    });
    try {
      const seen: string[][] = [];
      client.onUpdate(anyApi.notes.list, {}, (value) => seen.push(value as string[]));
      await client.mutation(anyApi.notes.add, { text: "kept" });
      const backup = exported(engine);
      await client.mutation(anyApi.notes.add, { text: "rolled back" });
      await eventually(
        () => seen.at(-1),
        (value) => value?.length === 2,
      );

      await scheduler.pause(Date.now() + 1000);
      await expect(client.mutation(anyApi.notes.add, { text: "refused" })).rejects.toThrow(
        /Server Error/,
      );
      await restore(engine, parse(backup.split("\n")));
      // The subscription is pushed the restored state, not left on the old one.
      await eventually(
        () => seen.at(-1),
        (value) => JSON.stringify(value) === JSON.stringify(["kept"]),
      );
      await engine.resume();
      await client.mutation(anyApi.notes.add, { text: "after resume" });
      await eventually(
        () => seen.at(-1),
        (value) => JSON.stringify(value) === JSON.stringify(["kept", "after resume"]),
      );
    } finally {
      await client.close();
    }
  });
});
