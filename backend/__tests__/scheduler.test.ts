import {
  actionGeneric,
  cronJobs,
  defineSchema,
  defineTable,
  internalMutationGeneric,
  makeFunctionReference,
  mutationGeneric,
} from "convex/server";
import { v } from "convex/values";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as chrondleCrons from "../../convex/crons";
import schema from "../../convex/schema";
import { convexModules } from "../src/convexModules.gen";
import { Engine, SYSTEM } from "../src/engine/engine";
import {
  INTERRUPTED,
  nextOccurrence,
  parseCrons,
  previousOccurrence,
  retryDelay,
  Scheduler,
} from "../src/engine/scheduler";
import { SCHEDULED_FUNCTIONS, type Sql } from "../src/engine/store";
import { memorySql } from "./sqlite";
import { makeEngine } from "./support";

const syntheticSchema = defineSchema({ notes: defineTable({ text: v.string() }) });
const work = makeFunctionReference<"mutation">("jobs:work");
const failing = makeFunctionReference<"action">("jobs:failing");

/** Lets a test hold a function mid-execution. */
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}

const modules = {
  jobs: {
    enqueue: mutationGeneric({
      args: { text: v.string() },
      handler: async (ctx, { text }) => {
        await ctx.scheduler.runAfter(0, work, { text: `${text} now` });
        await ctx.scheduler.runAfter(60_000, work, { text: `${text} later` });
      },
    }),
    enqueueNow: mutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.scheduler.runAfter(0, work, { text }),
    }),
    enqueueThenFail: mutationGeneric({
      args: {},
      handler: async (ctx) => {
        await ctx.scheduler.runAfter(0, work, { text: "never" });
        throw new Error("rolled back");
      },
    }),
    enqueueFailing: mutationGeneric({
      args: {},
      handler: (ctx) => ctx.scheduler.runAfter(0, failing, {}),
    }),
    enqueueBroken: mutationGeneric({
      args: {},
      handler: (ctx) =>
        ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("jobs:broken"), {}),
    }),
    work: internalMutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.db.insert("notes", { text }),
    }),
    broken: internalMutationGeneric({
      args: {},
      handler: async () => {
        throw new Error("bug in the function");
      },
    }),
    failing: actionGeneric({
      args: {},
      handler: async () => {
        throw new Error("provider unavailable");
      },
    }),
  },
};

afterEach(() => {
  vi.useRealTimers();
});

/** One fake wall clock for the engine, the scheduler and Convex's own `Date.now()` in `runAfter`. */
function harness(start: string, crons = [] as ReturnType<typeof parseCrons>) {
  vi.useFakeTimers({ toFake: ["Date"], now: Date.parse(start) });
  const clock = {
    get now() {
      return Date.now();
    },
    set now(value: number) {
      vi.setSystemTime(value);
    },
  };
  const engine = makeEngine(syntheticSchema, modules);
  const scheduler = new Scheduler(engine, crons);
  const jobs = () =>
    [...engine.store.allDocuments(SCHEDULED_FUNCTIONS)].sort(
      (a, b) => a._creationTime - b._creationTime,
    ) as Array<Record<string, any>>;
  const notes = () =>
    [...engine.store.allDocuments("notes")]
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((note) => note.text);
  return { clock, engine, scheduler, jobs, notes };
}

/** An engine over `sql` that can be told to fail its next commit, like a storage fault. */
function faultyEngine(sql: Sql) {
  const fault = { nextCommit: false };
  const engine = new Engine({
    sql: {
      exec: sql.exec.bind(sql),
      transaction: (fn) => {
        if (fault.nextCommit) {
          fault.nextCommit = false;
          throw new Error("injected storage failure at commit");
        }
        return sql.transaction(fn);
      },
    },
    schemaExport: (syntheticSchema as unknown as { export(): string }).export(),
    modules,
  });
  return { engine, fault };
}

describe("scheduled functions", () => {
  it("runs due jobs exactly once and keeps future jobs pending until their time", async () => {
    const { clock, engine, scheduler, jobs, notes } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueue", { text: "job" }, null);
    await scheduler.runDue();
    await scheduler.runDue();
    expect(notes()).toEqual(["job now"]);
    expect(jobs().map((job) => [job.args[0].text, job.state.kind])).toEqual([
      ["job now", "success"],
      ["job later", "pending"],
    ]);
    expect(scheduler.nextWakeTime()).toBe(clock.now + 60_000);

    clock.now += 60_000;
    await scheduler.runDue();
    expect(notes()).toEqual(["job now", "job later"]);
    expect(
      jobs().every((job) => job.state.kind === "success" && typeof job.completedTime === "number"),
    ).toBe(true);
  });

  it("starts nothing and arms no wake-up while writes are paused, then catches up", async () => {
    const { clock, engine, scheduler, jobs, notes } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueue", { text: "job" }, null);
    engine.fence();
    clock.now += 120_000;
    await scheduler.runDue();
    expect(notes()).toEqual([]);
    // A due job must not re-arm the alarm for "now" over and over while paused.
    expect(scheduler.nextWakeTime()).toBeNull();
    expect(jobs().map((job) => job.state.kind)).toEqual(["pending", "pending"]);

    await engine.resume();
    expect(scheduler.nextWakeTime()).toBeLessThanOrEqual(clock.now);
    await scheduler.runDue();
    expect(notes()).toEqual(["job now", "job later"]);
  });

  it("pauses only a database that was never paused or resumed", async () => {
    const { engine } = harness("2026-10-15T12:00:00Z");
    engine.pauseIfNew();
    expect(engine.writeMode).toBe("paused");
    await engine.resume();
    engine.pauseIfNew();
    expect(engine.writeMode).toBe("live");
  });

  it("schedules nothing when the scheduling mutation fails", async () => {
    const { engine, jobs } = harness("2026-10-15T12:00:00Z");
    await expect(engine.runMutation("jobs:enqueueThenFail", {}, null)).rejects.toThrow(
      "rolled back",
    );
    expect(jobs()).toHaveLength(0);
  });

  it("records a failed action with its error and does not retry it", async () => {
    const { engine, scheduler, jobs } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueueFailing", {}, null);
    await scheduler.runDue();
    await scheduler.runDue();
    expect(jobs().map((job) => job.state)).toEqual([
      { kind: "failed", error: expect.stringContaining("provider unavailable") },
    ]);
  });

  it("fails a scheduled mutation whose function throws, without retrying it", async () => {
    const { engine, scheduler, jobs } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueueBroken", {}, null);
    await scheduler.runDue();
    await scheduler.runDue();
    expect(jobs().map((job) => [job.state, job.attempts])).toEqual([
      [{ kind: "failed", error: expect.stringContaining("bug in the function") }, undefined],
    ]);
  });

  it("fails actions that a restart interrupted, like Convex", async () => {
    const { engine, scheduler, jobs } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueueFailing", {}, null);
    const [job] = jobs();
    await engine.writeExclusive(SYSTEM, ({ write }) =>
      write(SCHEDULED_FUNCTIONS, job._id, { ...job, state: { kind: "inProgress" } } as never),
    );
    await scheduler.start();
    expect(jobs()[0].state).toEqual({ kind: "failed", error: INTERRUPTED });
  });

  it("prunes finished jobs after Convex's 7-day retention", async () => {
    const { clock, engine, scheduler, jobs } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueue", { text: "old" }, null);
    await scheduler.runDue();
    clock.now += 8 * 24 * 60 * 60 * 1000;
    expect(await scheduler.prune()).toBe(1);
    expect(jobs().map((job) => job.args[0].text)).toEqual(["old later"]);
  });
});

describe("scheduled mutations after an engine failure", () => {
  it("stay pending and are retried at once, then delivered exactly once", async () => {
    // The review's probe: a one-shot storage failure at the mutation's commit.
    const { engine, fault } = faultyEngine(memorySql());
    const scheduler = new Scheduler(engine, []);
    await engine.runMutation("jobs:enqueueNow", { text: "retry me" }, null);
    fault.nextCommit = true;
    await scheduler.runDue();
    const [afterFailure] = [...engine.store.allDocuments(SCHEDULED_FUNCTIONS)];
    expect(afterFailure.state).toEqual({ kind: "pending" });
    expect(afterFailure.attempts).toBe(1);
    expect(engine.store.countTable("notes")).toBe(0);

    await scheduler.runDue();
    await scheduler.runDue();
    expect(scheduler.status().jobs).toEqual({ success: 1 });
    expect(engine.store.countTable("notes")).toBe(1);
  });

  it("back off durably while failures repeat, across a restart", async () => {
    const sql = memorySql();
    let now = Date.parse("2026-10-15T12:00:00Z");
    vi.useFakeTimers({ toFake: ["Date"], now });
    const { engine, fault } = faultyEngine(sql);
    await engine.runMutation("jobs:enqueueNow", { text: "eventually" }, null);
    const scheduler = new Scheduler(engine, [], () => now);
    const job = () => [...engine.store.allDocuments(SCHEDULED_FUNCTIONS)][0];

    fault.nextCommit = true;
    await scheduler.runDue(); // attempt 1 fails: retry at once
    fault.nextCommit = true;
    await scheduler.runDue(); // attempt 2 fails: retry in 1 s
    expect(job()).toMatchObject({ attempts: 2, retryAfter: now + retryDelay(2) });
    expect(retryDelay(2)).toBe(1000);
    await scheduler.runDue(); // not yet due
    expect(engine.store.countTable("notes")).toBe(0);

    // The backoff is stored: a restarted scheduler waits for it too.
    const restarted = new Scheduler(new Engine({ ...engineOptions(sql) }), [], () => now);
    expect(restarted.nextWakeTime()).toBe(now + 1000);
    now += 1000;
    await restarted.runDue();
    expect(job().state).toEqual({ kind: "success" });
    expect(engine.store.countTable("notes")).toBe(1);
    expect(retryDelay(30)).toBe(5 * 60_000);
  });
});

function engineOptions(sql: Sql) {
  return {
    sql,
    schemaExport: (syntheticSchema as unknown as { export(): string }).export(),
    modules,
  };
}

describe("crons", () => {
  const daily = cronJobs();
  daily.daily("note at midnight", { hourUTC: 0, minuteUTC: 0 }, work, { text: "midnight" });
  const dailyCrons = () => parseCrons({ default: daily as never });

  it("computes daily occurrences in UTC", () => {
    const schedule = { type: "daily" as const, hourUTC: 2, minuteUTC: 0 };
    expect(
      new Date(previousOccurrence(schedule, Date.parse("2026-10-15T01:59:59Z"))).toISOString(),
    ).toBe("2026-10-14T02:00:00.000Z");
    expect(
      new Date(nextOccurrence(schedule, Date.parse("2026-10-15T02:00:00Z"))).toISOString(),
    ).toBe("2026-10-16T02:00:00.000Z");
  });

  it("runs a cron once per occurrence and never retroactively on first boot", async () => {
    const { clock, scheduler, notes, jobs } = harness("2026-10-14T23:59:00Z", dailyCrons());
    await scheduler.start();
    await scheduler.runDue();
    expect(notes()).toEqual([]);
    expect(jobs()).toEqual([]);
    expect(new Date(scheduler.nextWakeTime()!).toISOString()).toBe("2026-10-15T00:00:00.000Z");

    clock.now = Date.parse("2026-10-15T00:00:30Z");
    await scheduler.runDue();
    await scheduler.runDue();
    expect(notes()).toEqual(["midnight"]);
    expect(scheduler.status().crons[0]).toMatchObject({
      lastOccurrence: Date.parse("2026-10-15T00:00:00Z"),
      lastJob: { scheduledTime: Date.parse("2026-10-15T00:00:00Z"), state: { kind: "success" } },
    });
  });

  it("does not lose an occurrence to a restart on either side of its dispatch", async () => {
    const crons = dailyCrons();
    // Restart after the occurrence was dispatched but before its mutation committed.
    const sql = memorySql();
    let now = Date.parse("2026-10-14T23:59:00Z");
    const entered = gate();
    const abandoned = gate();
    let first = true;
    const hanging = {
      jobs: {
        ...modules.jobs,
        work: internalMutationGeneric({
          args: { text: v.string() },
          handler: async (ctx, { text }) => {
            if (first) {
              first = false;
              entered.release();
              await abandoned.promise; // the crashed instance never finishes
            }
            return ctx.db.insert("notes", { text });
          },
        }),
      },
    };
    const make = () => new Engine({ ...engineOptions(sql), modules: hanging });
    const before = new Scheduler(make(), crons, () => now);
    await before.runDue(); // first boot: cursor at the last occurrence, nothing runs
    now = Date.parse("2026-10-15T00:00:00Z");
    void before.runDue();
    await entered.promise;
    const recoveredEngine = make();
    const recovered = new Scheduler(recoveredEngine, crons, () => now);
    await recovered.start();
    await recovered.runDue();
    expect([...recoveredEngine.store.allDocuments("notes")].map((n) => n.text)).toEqual([
      "midnight",
    ]);

    // Restart before the dispatch committed: the cursor did not move either.
    const other = memorySql();
    now = Date.parse("2026-10-14T23:59:00Z");
    const engineA = new Engine(engineOptions(other));
    await new Scheduler(engineA, crons, () => now).runDue();
    now = Date.parse("2026-10-15T00:05:00Z"); // crashed before the 00:00 alarm ran
    const engineB = new Engine(engineOptions(other));
    const schedulerB = new Scheduler(engineB, crons, () => now);
    await schedulerB.start();
    expect(schedulerB.nextWakeTime()).toBe(now);
    await schedulerB.runDue();
    await schedulerB.runDue();
    expect([...engineB.store.allDocuments("notes")].map((n) => n.text)).toEqual(["midnight"]);
  });

  it("wakes at once for an overdue occurrence after a restart (watchdog)", async () => {
    // The review's probe: initialised at 23:59, restarted at 00:02.
    const sql = memorySql();
    let now = Date.parse("2026-10-14T23:59:00Z");
    await new Scheduler(new Engine(engineOptions(sql)), dailyCrons(), () => now).runDue();
    now = Date.parse("2026-10-15T00:02:00Z");
    const recovered = new Scheduler(new Engine(engineOptions(sql)), dailyCrons(), () => now);
    await recovered.start();
    expect(recovered.nextWakeTime()).toBeLessThanOrEqual(now);
  });

  it("registers Chrondle's five crons against functions that exist", () => {
    const engine = makeEngine(schema, convexModules);
    const crons = parseCrons(chrondleCrons as never);
    expect(
      crons.map((cron) => [
        cron.path,
        `${cron.schedule.type} ${(cron.schedule as { hourUTC: number }).hourUTC}:${(cron.schedule as { minuteUTC: number }).minuteUTC}`,
      ]),
    ).toEqual([
      ["puzzles:generateDailyPuzzle", "daily 0:0"],
      ["puzzles:generateTomorrowPuzzle", "daily 0:1"],
      ["actions/eventGeneration/orchestrator:generateDailyBatch", "daily 2:0"],
      ["orderPuzzles:generateDailyOrderPuzzle", "daily 0:0"],
      ["orderPuzzles:generateTomorrowOrderPuzzle", "daily 0:1"],
    ]);
    expect(() => new Scheduler(engine, crons)).not.toThrow();
  });
});
