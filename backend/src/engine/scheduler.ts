/**
 * Scheduled functions (`ctx.scheduler`) and crons (`convex/crons.ts`).
 *
 * Jobs live in `_scheduled_functions` and are committed atomically with the
 * mutation that scheduled them. Due jobs start as soon as they are committed
 * (`runDue` from the commit hook); the Durable Object alarm covers future
 * jobs, crons and restarts. Delivery follows Convex:
 *
 * - a scheduled mutation records its success in the same transaction as its
 *   writes, so it runs exactly once; an engine or storage failure leaves it
 *   pending and it is retried with backoff; a function error fails it
 * - an action is marked `inProgress` before it runs and is never retried (at
 *   most once); one a restart or a pause interrupted is marked failed
 * - a cron occurrence is dispatched by committing its job together with the
 *   cron's cursor, so a restart can neither lose nor repeat it
 */
import type { JSONValue, Value } from "convex/values";
import { jsonToConvex } from "convex/values";
import {
  SystemError,
  SYSTEM,
  WritesPausedError,
  type Engine,
  type Unit,
  type Writer,
} from "./engine";
import { cronCursorKey, indexesFor, keyRange, SCHEDULED_FUNCTIONS, type Doc } from "./store";

export type CronSchedule =
  | { type: "daily"; hourUTC: number; minuteUTC: number }
  | { type: "hourly"; minuteUTC?: number }
  | { type: "interval"; seconds?: number; minutes?: number; hours?: number };

export type CronSpec = {
  name: string;
  path: string;
  args: Record<string, Value>;
  schedule: CronSchedule;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Convex keeps finished scheduled-function records for 7 days. */
const JOB_RETENTION_MS = 7 * DAY;
/** Retry delays after an engine failure: at once, then 1 s doubling to 5 min. */
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 5 * MINUTE;
export const INTERRUPTED = "Transient error while executing action";

export function retryDelay(attempts: number): number {
  return attempts <= 1 ? 0 : Math.min(RETRY_BASE_MS * 2 ** (attempts - 2), RETRY_MAX_MS);
}

/** Read the `cronJobs()` registry exported by convex/crons.ts. */
export function parseCrons(cronsModule: {
  default?: { crons?: Record<string, { name: string; args: JSONValue[]; schedule: CronSchedule }> };
}): CronSpec[] {
  const registry = cronsModule.default?.crons ?? {};
  return Object.entries(registry).map(([name, job]) => {
    const schedule = job.schedule;
    if (!["daily", "hourly", "interval"].includes(schedule.type)) {
      throw new Error(`Cron "${name}" uses unsupported schedule type ${schedule.type}`);
    }
    return {
      name,
      path: job.name,
      args: jsonToConvex(job.args[0] ?? {}) as Record<string, Value>,
      schedule,
    };
  });
}

function period(schedule: CronSchedule): { every: number; offset: number } {
  switch (schedule.type) {
    case "daily":
      return { every: DAY, offset: schedule.hourUTC * HOUR + schedule.minuteUTC * MINUTE };
    case "hourly":
      return { every: HOUR, offset: (schedule.minuteUTC ?? 0) * MINUTE };
    case "interval":
      return {
        every:
          (schedule.seconds ?? 0) * 1000 +
          (schedule.minutes ?? 0) * MINUTE +
          (schedule.hours ?? 0) * HOUR,
        offset: 0,
      };
  }
}

/** Latest scheduled instant at or before `now`. */
export function previousOccurrence(schedule: CronSchedule, now: number): number {
  const { every, offset } = period(schedule);
  return Math.floor((now - offset) / every) * every + offset;
}

export function nextOccurrence(schedule: CronSchedule, now: number): number {
  return previousOccurrence(schedule, now) + period(schedule).every;
}

type JobState = {
  kind: "pending" | "inProgress" | "success" | "failed" | "canceled";
  error?: string;
};

const stateOf = (job: Doc) => (job.state as JobState).kind;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The job a scheduled mutation was about to run was canceled or already handled. */
class JobGone extends Error {}

export class Scheduler {
  /** Job ids executing in this instance. */
  private running = new Set<string>();
  /** Retry state kept in memory too, in case storage could not record it. */
  private retries = new Map<string, { attempts: number; at: number }>();

  constructor(
    private readonly engine: Engine,
    readonly crons: CronSpec[],
    private readonly now: () => number = Date.now,
  ) {
    for (const cron of crons) {
      if (engine.resolve(cron.path, null, "internal").kind === "query")
        throw new Error(`Cron "${cron.name}" targets a query; crons run mutations or actions`);
    }
  }

  private get byStateTime() {
    return indexesFor(this.engine.store.schema, SCHEDULED_FUNCTIONS).find((index) =>
      index.name.endsWith(".by_state_time"),
    )!;
  }

  private jobsIn(state: JobState["kind"], until?: number): Doc[] {
    const index = this.byStateTime;
    const range = keyRange(index, [
      { type: "Eq", fieldPath: "state.kind", value: state },
      ...(until === undefined
        ? []
        : [{ type: "Lte" as const, fieldPath: "scheduledTime", value: until }]),
    ]);
    return [...this.engine.store.scan(index, range, "asc")].map(({ doc }) => doc);
  }

  /** When a pending job may next run: its time, pushed back by any retry backoff. */
  private dueAt(job: Doc): number {
    return Math.max(
      job.scheduledTime as number,
      (job.retryAfter as number | undefined) ?? 0,
      this.retries.get(job._id)?.at ?? 0,
    );
  }

  /** Pending jobs that may start now and are not already running here. */
  private startable(now: number): Doc[] {
    return this.jobsIn("pending", now).filter(
      (job) => !this.running.has(job._id) && this.dueAt(job) <= now,
    );
  }

  /** Actions marked running that no execution in this instance owns. */
  private orphaned(): Doc[] {
    return this.jobsIn("inProgress").filter((job) => !this.running.has(job._id));
  }

  /** Crons whose cursor is missing or behind their latest occurrence. */
  private overdueCrons(now: number): CronSpec[] {
    return this.crons.filter((cron) => {
      const cursor = this.engine.store.cronCursor(cron.name);
      return cursor === null || cursor < previousOccurrence(cron.schedule, now);
    });
  }

  /** Run `fn` as one admitted unit; resolves undefined when writes are paused. */
  private async asUnit<T>(label: string, fn: (unit: Unit) => Promise<T>): Promise<T | undefined> {
    let unit: Unit;
    try {
      unit = this.engine.admit("scheduled", label);
    } catch (error) {
      if (error instanceof WritesPausedError) return undefined;
      throw error;
    }
    try {
      return await fn(unit);
    } catch (error) {
      if (error instanceof WritesPausedError) return undefined;
      throw error;
    } finally {
      this.engine.release(unit);
    }
  }

  /**
   * Recover after a restart: actions it interrupted are failed, like on
   * Convex. While live, a cron without a cursor starts counting from now
   * (boot), so an occurrence after boot is never mistaken for an old one.
   */
  async start(): Promise<void> {
    await this.failInProgress(SYSTEM, false);
    if (this.engine.writeMode === "live") await this.advanceCrons(this.now(), false);
  }

  /**
   * Fail actions still marked running. After a pause (`all`), even ones still
   * executing here: none of their writes can land any more.
   */
  async failInProgress(writer: Writer, all: boolean): Promise<string[]> {
    const jobs = all ? this.jobsIn("inProgress") : this.orphaned();
    if (jobs.length === 0) return [];
    const failed: string[] = [];
    await this.engine.writeExclusive(writer, ({ write }) => {
      for (const { _id } of jobs) {
        const job = this.engine.store.getCommitted(_id);
        if (!job || stateOf(job) !== "inProgress" || (!all && this.running.has(_id))) continue;
        write(SCHEDULED_FUNCTIONS, _id, {
          ...job,
          state: { kind: "failed", error: INTERRUPTED },
          completedTime: this.now(),
        } as Doc);
        failed.push(_id);
      }
    });
    return failed;
  }

  nextWakeTime(): number | null {
    // Nothing starts unless writes are live; resuming re-arms the alarm.
    if (this.engine.writeMode !== "live") return null;
    const now = this.now();
    // Overdue or interrupted work wakes the object at once (restart, watchdog).
    if (this.overdueCrons(now).length > 0 || this.orphaned().length > 0) return now;
    let next: number | null = null;
    for (const job of this.jobsIn("pending"))
      if (!this.running.has(job._id)) next = Math.min(next ?? Infinity, this.dueAt(job));
    for (const cron of this.crons)
      next = Math.min(next ?? Infinity, nextOccurrence(cron.schedule, now));
    return next;
  }

  /**
   * Give each cron without a cursor (new, or missing from an import) the
   * occurrence before `now`, so it starts at its next one rather than
   * retroactively; with `dispatch`, also dispatch every overdue occurrence,
   * its job and its cursor committed together.
   */
  private async advanceCrons(now: number, dispatch: boolean): Promise<void> {
    const due = this.overdueCrons(now).filter(
      (cron) => dispatch || this.engine.store.cronCursor(cron.name) === null,
    );
    if (due.length === 0) return;
    await this.asUnit("crons", (unit) =>
      this.engine.writeExclusive(unit, ({ write, setMeta }) => {
        for (const cron of due) {
          const occurrence = previousOccurrence(cron.schedule, now);
          const cursor = this.engine.store.cronCursor(cron.name);
          if (cursor !== null && (cursor >= occurrence || !dispatch)) continue;
          if (cursor !== null) {
            const job = this.engine.newJob(cron.path, cron.args, occurrence);
            write(SCHEDULED_FUNCTIONS, job._id, job);
          }
          setMeta(cronCursorKey(cron.name), String(occurrence));
        }
      }),
    );
  }

  private async runJob(job: Doc, unit: Unit): Promise<void> {
    const path = job.name as string;
    const args = (job.args as Value[])[0] as Record<string, Value>;
    const store = this.engine.store;
    try {
      const { kind } = this.engine.resolve(path, null, "internal");
      if (kind === "mutation") {
        await this.engine.runMutation(path, args, null, {
          visibility: "internal",
          unit,
          onSuccess: ({ write }) => {
            const current = store.getCommitted(job._id);
            if (!current || stateOf(current) !== "pending") throw new JobGone();
            write(SCHEDULED_FUNCTIONS, job._id, {
              ...current,
              state: { kind: "success" },
              completedTime: this.now(),
            } as Doc);
          },
        });
        this.retries.delete(job._id);
        return;
      }
      let claimed = false;
      await this.engine.writeExclusive(unit, ({ write }) => {
        const current = store.getCommitted(job._id);
        if (!current || stateOf(current) !== "pending") return;
        write(SCHEDULED_FUNCTIONS, job._id, { ...current, state: { kind: "inProgress" } } as Doc);
        claimed = true;
      });
      this.retries.delete(job._id);
      if (!claimed) return;
      let outcome: JobState;
      try {
        await this.engine.runAction(path, args, null, { visibility: "internal", unit });
        outcome = { kind: "success" };
      } catch (error) {
        console.error(`[scheduler] ${path} (${job._id}) failed`, error);
        outcome = { kind: "failed", error: messageOf(error) };
      }
      // If this cannot be recorded (paused, storage), the job stays inProgress
      // and is failed as interrupted: an action never runs twice.
      await this.engine
        .writeExclusive(unit, ({ write }) => {
          const current = store.getCommitted(job._id);
          if (current && stateOf(current) === "inProgress")
            write(SCHEDULED_FUNCTIONS, job._id, {
              ...current,
              state: outcome,
              completedTime: this.now(),
            } as Doc);
        })
        .catch((error) => console.error(`[scheduler] ${path} (${job._id}) unrecorded`, error));
    } catch (error) {
      await this.notRun(job, unit, error);
    }
  }

  /** A job that did not run: keep it for after a pause, retry an engine failure, fail a function error. */
  private async notRun(job: Doc, unit: Unit, error: unknown): Promise<void> {
    if (error instanceof JobGone || error instanceof WritesPausedError) return;
    const retry = error instanceof SystemError;
    console.error(
      `[scheduler] ${job.name as string} (${job._id}) ${retry ? "will retry" : "failed"}`,
      error,
    );
    let backoff: { attempts: number; at: number } | null = null;
    if (retry) {
      // Kept in memory first: when storage is failing, recording it may fail too.
      const attempts =
        Math.max(
          (job.attempts as number | undefined) ?? 0,
          this.retries.get(job._id)?.attempts ?? 0,
        ) + 1;
      backoff = { attempts, at: this.now() + retryDelay(attempts) };
      this.retries.set(job._id, backoff);
    }
    try {
      await this.engine.writeExclusive(unit, ({ write }) => {
        const current = this.engine.store.getCommitted(job._id);
        if (!current || stateOf(current) !== "pending") return;
        write(
          SCHEDULED_FUNCTIONS,
          job._id,
          (backoff
            ? { ...current, attempts: backoff.attempts, retryAfter: backoff.at }
            : {
                ...current,
                state: { kind: "failed", error: messageOf(error) },
                completedTime: this.now(),
              }) as Doc,
        );
      });
      this.retries.delete(job._id);
    } catch (recordError) {
      console.error(`[scheduler] could not record ${job._id}`, recordError);
    }
  }

  /**
   * Start every due job not already running; resolves when they finish.
   * While live this also fails orphaned actions and dispatches due crons; while
   * draining it only runs jobs, so a pause can settle the queue. Rejects if
   * recovery or cron dispatch failed (the alarm then retries with backoff).
   */
  async runDue(): Promise<void> {
    const mode = this.engine.writeMode;
    if (mode === "paused") return;
    const now = this.now();
    const failures: unknown[] = [];
    if (mode === "live") {
      await this.asUnit("recovery", (unit) => this.failInProgress(unit, false)).catch((error) =>
        failures.push(error),
      );
      await this.advanceCrons(now, true).catch((error) => failures.push(error));
    }
    const started: Promise<unknown>[] = [];
    for (const job of this.startable(this.now())) {
      this.running.add(job._id);
      started.push(
        this.asUnit(`job ${job.name as string}`, (unit) => this.runJob(job, unit)).finally(() =>
          this.running.delete(job._id),
        ),
      );
    }
    await Promise.allSettled(started);
    if (failures.length) throw new AggregateError(failures, "Scheduler bookkeeping failed");
  }

  /**
   * Pause writes as a barrier: stop admitting client and cron work, let
   * admitted work and due jobs finish until `deadline` (`settle`), then fence.
   * Once this resolves no write but an import lands; actions still running at
   * the deadline were cut off and are recorded as failed (`interrupted`).
   */
  async pause(deadline: number): Promise<{ settled: boolean; interrupted: string[] }> {
    this.engine.beginDrain();
    const settled = await this.settle(deadline);
    const interrupted = await this.failInProgress(SYSTEM, true);
    return { settled, interrupted };
  }

  /**
   * Run due jobs and wait for admitted work until nothing runs and nothing is
   * due, then fence. At `deadline` it fences anyway and returns false.
   */
  private async settle(deadline: number): Promise<boolean> {
    for (;;) {
      if (this.engine.writeMode === "paused") return true;
      const startable = this.startable(this.now());
      // Checked and paused in one synchronous step: nothing can start in between.
      if (startable.length === 0 && !this.engine.busy) {
        this.engine.fence();
        return true;
      }
      const remaining = deadline - this.now();
      if (remaining <= 0) {
        this.engine.fence();
        return false;
      }
      if (startable.length > 0)
        await this.runDue().catch((error) => console.error("[scheduler] settle", error));
      else await this.engine.whenIdle(Math.min(remaining, 1000));
    }
  }

  /** Delete finished job records past Convex's retention window; returns how many. */
  async prune(): Promise<number> {
    const cutoff = this.now() - JOB_RETENTION_MS;
    const expired = (["success", "failed", "canceled"] as const)
      .flatMap((state) => this.jobsIn(state))
      .filter((job) => typeof job.completedTime === "number" && job.completedTime < cutoff);
    if (expired.length === 0) return 0;
    const pruned = await this.asUnit("prune", async (unit) => {
      await this.engine.writeExclusive(unit, ({ write }) =>
        expired.forEach((job) => write(SCHEDULED_FUNCTIONS, job._id, null)),
      );
      return expired.length;
    });
    return pruned ?? 0;
  }

  status() {
    const store = this.engine.store;
    const counts: Record<string, number> = {};
    const jobs = [...store.allDocuments(SCHEDULED_FUNCTIONS)];
    for (const job of jobs) counts[stateOf(job)] = (counts[stateOf(job)] ?? 0) + 1;
    const byTime = jobs.sort((a, b) => b._creationTime - a._creationTime);
    return {
      now: this.now(),
      writes: this.engine.writeMode,
      nextWake: this.nextWakeTime(),
      running: [...this.running],
      jobs: counts,
      recentJobs: byTime.slice(0, 20).map((job) => ({
        id: job._id,
        name: job.name,
        scheduledTime: job.scheduledTime,
        completedTime: job.completedTime ?? null,
        attempts: job.attempts ?? 0,
        retryAfter: job.retryAfter ?? null,
        state: job.state,
      })),
      crons: this.crons.map((cron) => {
        const last = byTime.find((job) => job.name === cron.path);
        return {
          name: cron.name,
          path: cron.path,
          lastOccurrence: store.cronCursor(cron.name),
          nextOccurrence: nextOccurrence(cron.schedule, this.now()),
          lastJob: last
            ? { id: last._id, scheduledTime: last.scheduledTime, state: last.state }
            : null,
        };
      }),
    };
  }
}
