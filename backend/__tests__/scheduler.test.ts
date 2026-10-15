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
import { nextOccurrence, parseCrons, previousOccurrence, Scheduler } from "../src/engine/scheduler";
import { SCHEDULED_FUNCTIONS } from "../src/engine/store";
import { makeEngine } from "./support";

const syntheticSchema = defineSchema({ notes: defineTable({ text: v.string() }) });
const work = makeFunctionReference<"mutation">("jobs:work");
const failing = makeFunctionReference<"action">("jobs:failing");

const modules = {
  jobs: {
    enqueue: mutationGeneric({
      args: { text: v.string() },
      handler: async (ctx, { text }) => {
        await ctx.scheduler.runAfter(0, work, { text: `${text} now` });
        await ctx.scheduler.runAfter(60_000, work, { text: `${text} later` });
      },
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
    work: internalMutationGeneric({
      args: { text: v.string() },
      handler: (ctx, { text }) => ctx.db.insert("notes", { text }),
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
    engine.setWritesPaused(true);
    clock.now += 120_000;
    await scheduler.runDue();
    expect(notes()).toEqual([]);
    // A due job must not re-arm the alarm for "now" over and over while paused.
    expect(scheduler.nextWakeTime()).toBeNull();
    expect(jobs().map((job) => job.state.kind)).toEqual(["pending", "pending"]);

    engine.setWritesPaused(false);
    expect(scheduler.nextWakeTime()).toBeLessThanOrEqual(clock.now);
    await scheduler.runDue();
    expect(notes()).toEqual(["job now", "job later"]);
  });

  it("pauses only a database that was never paused or resumed", () => {
    const { engine } = harness("2026-10-15T12:00:00Z");
    engine.pauseIfNew();
    expect(engine.writesPaused).toBe(true);
    engine.setWritesPaused(false);
    engine.pauseIfNew();
    expect(engine.writesPaused).toBe(false);
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

  it("fails actions that a restart interrupted, like Convex", async () => {
    const { engine, scheduler, jobs } = harness("2026-10-15T12:00:00Z");
    await engine.runMutation("jobs:enqueueFailing", {}, null);
    const [job] = jobs();
    await engine.writeExclusive((write) =>
      write(SCHEDULED_FUNCTIONS, job._id, { ...job, state: { kind: "inProgress" } } as never),
    );
    await scheduler.start();
    expect(jobs()[0].state).toEqual({
      kind: "failed",
      error: "Transient error while executing action",
    });
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

describe("crons", () => {
  const daily = cronJobs();
  daily.daily("note at midnight", { hourUTC: 0, minuteUTC: 0 }, work, { text: "midnight" });

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
    const { clock, scheduler, notes } = harness(
      "2026-10-14T23:59:00Z",
      parseCrons({ default: daily as never }),
    );
    await scheduler.start();
    await scheduler.runDue();
    expect(notes()).toEqual([]);
    expect(new Date(scheduler.nextWakeTime()!).toISOString()).toBe("2026-10-15T00:00:00.000Z");

    clock.now = Date.parse("2026-10-15T00:00:30Z");
    await scheduler.runDue();
    await scheduler.runDue();
    expect(notes()).toEqual(["midnight"]);
    expect(scheduler.status().crons[0]).toMatchObject({
      lastOccurrence: Date.parse("2026-10-15T00:00:00Z"),
      lastRun: { ok: true },
    });
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
    for (const cron of crons)
      expect(() => engine.resolve(cron.path, null, "internal")).not.toThrow();
  });
});
