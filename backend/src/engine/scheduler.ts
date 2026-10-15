/**
 * Scheduled functions (`ctx.scheduler`) and crons (`convex/crons.ts`).
 *
 * Jobs live in `_scheduled_functions` and are committed atomically with the
 * mutation that scheduled them. Due jobs start as soon as they are committed
 * (`runDue` from the commit hook); the Durable Object alarm covers future
 * jobs, crons and restarts. A scheduled mutation's success is recorded in the
 * same transaction as its writes (exactly once); actions are marked
 * `inProgress` first and run at most once, like on Convex.
 */
import type { JSONValue, Value } from "convex/values";
import { jsonToConvex } from "convex/values";
import type { Engine } from "./engine";
import { indexesFor, keyRange, SCHEDULED_FUNCTIONS, type Doc } from "./store";

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

export class Scheduler {
  /** Job ids and `cron:<name>` keys currently executing in this instance. */
  private running = new Set<string>();

  constructor(
    private readonly engine: Engine,
    readonly crons: CronSpec[],
    private readonly now: () => number = Date.now,
  ) {}

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

  private lastCronOccurrence(cron: CronSpec): number {
    return Number(this.engine.store.getMeta(`cron:${cron.name}`) ?? 0);
  }

  /** Initialise cron bookkeeping and fail actions interrupted by a restart. */
  async start(): Promise<void> {
    const store = this.engine.store;
    for (const cron of this.crons) {
      // A new cron first runs at its next occurrence, not retroactively.
      if (store.getMeta(`cron:${cron.name}`) === null)
        store.setMeta(`cron:${cron.name}`, String(previousOccurrence(cron.schedule, this.now())));
    }
    const interrupted = this.jobsIn("inProgress").filter((job) => !this.running.has(job._id));
    if (interrupted.length === 0) return;
    await this.engine.writeExclusive((write) => {
      for (const job of interrupted) {
        write(SCHEDULED_FUNCTIONS, job._id, {
          ...job,
          state: { kind: "failed", error: "Transient error while executing action" },
          completedTime: this.now(),
        } as Doc);
      }
    });
  }

  nextWakeTime(): number | null {
    let next: number | null = null;
    for (const job of this.jobsIn("pending")) {
      if (!this.running.has(job._id)) {
        next = job.scheduledTime as number;
        break;
      }
    }
    for (const cron of this.crons) {
      const occurrence = nextOccurrence(cron.schedule, this.now());
      if (next === null || occurrence < next) next = occurrence;
    }
    return next;
  }

  private async runJob(job: Doc): Promise<void> {
    const path = job.name as string;
    const args = (job.args as Value[])[0] as Record<string, Value>;
    const finished = (state: JobState) => ({ ...job, state, completedTime: this.now() }) as Doc;
    try {
      const { kind } = this.engine.resolve(path, null, "internal");
      if (kind === "mutation") {
        await this.engine.runMutation(path, args, null, {
          visibility: "internal",
          onSuccess: (write) => write(SCHEDULED_FUNCTIONS, finished({ kind: "success" }), job._id),
        });
        return;
      }
      await this.engine.writeExclusive((write) =>
        write(SCHEDULED_FUNCTIONS, job._id, { ...job, state: { kind: "inProgress" } } as Doc),
      );
      await this.engine.runAction(path, args, null, { visibility: "internal" });
      await this.engine.writeExclusive((write) =>
        write(SCHEDULED_FUNCTIONS, job._id, finished({ kind: "success" })),
      );
    } catch (error) {
      console.error(`[scheduler] ${path} (${job._id}) failed`, error);
      const message = error instanceof Error ? error.message : String(error);
      await this.engine.writeExclusive((write) =>
        write(SCHEDULED_FUNCTIONS, job._id, finished({ kind: "failed", error: message })),
      );
    }
  }

  private async runCron(cron: CronSpec, occurrence: number): Promise<void> {
    const store = this.engine.store;
    // Recorded before running: a cron runs at most once per occurrence.
    store.setMeta(`cron:${cron.name}`, String(occurrence));
    const startedAt = this.now();
    try {
      await this.engine.runAny(cron.path, cron.args);
      store.setMeta(
        `cronStatus:${cron.name}`,
        JSON.stringify({ occurrence, startedAt, finishedAt: this.now(), ok: true }),
      );
    } catch (error) {
      console.error(`[cron] ${cron.name} failed`, error);
      const message = error instanceof Error ? error.message : String(error);
      store.setMeta(
        `cronStatus:${cron.name}`,
        JSON.stringify({
          occurrence,
          startedAt,
          finishedAt: this.now(),
          ok: false,
          error: message,
        }),
      );
    }
  }

  private async track(key: string, run: () => Promise<void>): Promise<void> {
    this.running.add(key);
    try {
      await run();
    } finally {
      this.running.delete(key);
    }
  }

  /** Start every due job and cron that is not already running; resolves when they finish. */
  runDue(): Promise<void> {
    const started: Promise<void>[] = [];
    for (const job of this.jobsIn("pending", this.now())) {
      if (!this.running.has(job._id)) started.push(this.track(job._id, () => this.runJob(job)));
    }
    for (const cron of this.crons) {
      const occurrence = previousOccurrence(cron.schedule, this.now());
      const key = `cron:${cron.name}`;
      if (this.lastCronOccurrence(cron) < occurrence && !this.running.has(key))
        started.push(this.track(key, () => this.runCron(cron, occurrence)));
    }
    return Promise.allSettled(started).then(() => undefined);
  }

  /** Delete finished job records past Convex's retention window. */
  async prune(): Promise<number> {
    const cutoff = this.now() - JOB_RETENTION_MS;
    const expired = (["success", "failed", "canceled"] as const)
      .flatMap((state) => this.jobsIn(state))
      .filter((job) => typeof job.completedTime === "number" && job.completedTime < cutoff);
    if (expired.length)
      await this.engine.writeExclusive((write) =>
        expired.forEach((job) => write(SCHEDULED_FUNCTIONS, job._id, null)),
      );
    return expired.length;
  }

  status() {
    const store = this.engine.store;
    const counts: Record<string, number> = {};
    const jobs = [...store.allDocuments(SCHEDULED_FUNCTIONS)];
    for (const job of jobs) {
      const kind = (job.state as JobState).kind;
      counts[kind] = (counts[kind] ?? 0) + 1;
    }
    return {
      now: this.now(),
      nextWake: this.nextWakeTime(),
      running: [...this.running],
      jobs: counts,
      recentJobs: jobs
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 20)
        .map((job) => ({
          id: job._id,
          name: job.name,
          scheduledTime: job.scheduledTime,
          completedTime: job.completedTime ?? null,
          state: job.state,
        })),
      crons: this.crons.map((cron) => ({
        name: cron.name,
        path: cron.path,
        lastOccurrence: this.lastCronOccurrence(cron),
        nextOccurrence: nextOccurrence(cron.schedule, this.now()),
        lastRun: JSON.parse(store.getMeta(`cronStatus:${cron.name}`) ?? "null"),
      })),
    };
  }
}
