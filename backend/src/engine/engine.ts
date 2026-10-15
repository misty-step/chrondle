/**
 * Convex function host.
 *
 * Runs the unmodified `convex/` functions by implementing the syscall
 * interface that the `convex/server` runtime calls (`globalThis.Convex`).
 * The package itself builds `ctx.db`, query/filter/index builders, auth,
 * scheduler and `ctx.run*`; this module only answers the syscalls:
 *
 * - queries read one committed state: commits wait for running queries
 *   (see `snapshot`), and Durable Object storage itself is synchronous
 * - mutations run one at a time, buffer writes, validate them against the
 *   schema and commit atomically with any scheduled jobs they created
 * - actions run concurrently and reach the database only through
 *   `ctx.runQuery` / `ctx.runMutation` like on Convex
 *
 * Every write belongs to a unit of work (a client request, a scheduled job,
 * a cron dispatch) or is a system write (imports, crash recovery). Pausing
 * writes is a barrier (see `WriteMode`): once paused, no unit's write lands,
 * including units admitted before the pause.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import { jsonToConvexOrUndefined, matchesFilter } from "./filter";
import { decodeDocumentId } from "./ids";
import {
  documentKey,
  indexesFor,
  keyRange,
  schemaInfoFromExport,
  SCHEDULED_FUNCTIONS,
  Store,
  type Doc,
  type IndexDef,
  type Range,
  type SerializedRange,
  type Sql,
} from "./store";
import { check, ValidationError, type ValidatorJSON } from "./validate";
import { KEY_MAX_SUFFIX } from "./keys";

export type FunctionKind = "query" | "mutation" | "action";
export type Visibility = "public" | "internal";
export type Identity = Record<string, JSONValue> & {
  tokenIdentifier: string;
  subject: string;
  issuer: string;
};

type RegisteredFunction = {
  isQuery?: boolean;
  isMutation?: boolean;
  isAction?: boolean;
  isPublic?: boolean;
  isInternal?: boolean;
  exportArgs(): string;
  exportReturns?(): string | null;
  invokeQuery?(args: string): Promise<string>;
  invokeMutation?(args: string): Promise<string>;
  invokeAction?(requestId: string, args: string): Promise<string>;
};

export type Modules = Record<string, Record<string, unknown>>;

export type ReadEntry =
  | { kind: "get"; id: string }
  | { kind: "range"; index: IndexDef; range: Range }
  | { kind: "table"; table: string };

export type Write = { table: string; before: Doc | null; after: Doc | null };
export type CommitInfo = { ts: bigint; writes: Map<string, Write> };

/** What a client sees for a failed function, shaped like Convex's wire errors. */
export type ClientError = { errorMessage: string; errorData: JSONValue | undefined };

/**
 * Writes are `live` (normal), `draining` (no new client or cron work; work
 * already admitted and scheduled jobs may finish) or `paused` (nothing but
 * system writes lands). Draining and paused are both stored as paused, so a
 * restart never resumes writes on its own.
 */
export type WriteMode = "live" | "draining" | "paused";

/** One admitted unit of work. Its writes land only in the epoch it was admitted in. */
export type Unit = { readonly epoch: number; readonly label: string };

/** Writer of engine-internal commits that the pause does not stop: imports, crash recovery. */
export const SYSTEM = Symbol("system write");
export type Writer = Unit | typeof SYSTEM;

/** Collects one atomic commit: document writes plus metadata. */
export type WriteSet = {
  write(table: string, id: string, after: Doc | null): void;
  setMeta(key: string, value: string): void;
};

/** A write refused because writes are paused, or because the work predates the pause. */
export class WritesPausedError extends Error {
  constructor(what: string) {
    super(`Writes are paused for maintenance (${what})`);
    this.name = "WritesPausedError";
  }
}

/** Import or restore attempted while writes are not paused. */
export class NotPausedError extends Error {
  constructor() {
    super("Pause writes first: POST /_backend/admin/pause");
    this.name = "NotPausedError";
  }
}

/** A failure of the engine or its storage rather than of the function: retryable. */
export class SystemError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SystemError";
  }
}

/** Storage failures surface as SystemError, whatever the SQLite binding throws. */
function guarded(sql: Sql): Sql {
  const fault = (error: unknown) =>
    error instanceof SystemError
      ? error
      : new SystemError(`Storage failure: ${error instanceof Error ? error.message : error}`, {
          cause: error,
        });
  return {
    exec: (query, ...params) => {
      try {
        return sql.exec(query, ...params);
      } catch (error) {
        throw fault(error);
      }
    },
    transaction: (fn) => {
      try {
        return sql.transaction(fn);
      } catch (error) {
        throw fault(error);
      }
    },
  };
}

class Transaction {
  private layers: Map<string, Write>[] = [new Map()];

  lookup(id: string): Write | undefined {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const write = this.layers[i].get(id);
      if (write) return write;
    }
    return undefined;
  }

  set(id: string, table: string, after: Doc | null, committed: () => Doc | null): void {
    const previous = this.lookup(id);
    const before = previous ? previous.before : committed();
    this.layers[this.layers.length - 1].set(id, { table, before, after });
  }

  push(): void {
    this.layers.push(new Map());
  }

  pop(keep: boolean): void {
    const top = this.layers.pop()!;
    if (keep) for (const [id, write] of top) this.layers[this.layers.length - 1].set(id, write);
  }

  writes(): Map<string, Write> {
    const merged = new Map<string, Write>();
    for (const layer of this.layers) for (const [id, write] of layer) merged.set(id, write);
    return merged;
  }
}

type ExecutionContext = {
  engine: Engine;
  kind: FunctionKind;
  identity: Identity | null;
  /** The unit this execution writes for; null for queries. */
  unit: Unit | null;
  txn: Transaction | null;
  readSet: ReadEntry[] | null;
  streams: Map<number, Iterator<Doc>>;
  nextStream: number;
  /** First engine failure seen by any syscall of this execution (shared with nested calls). */
  faults: { first?: SystemError };
};

const als = new AsyncLocalStorage<ExecutionContext>();
/** Meta key of the stored pause switch. */
const WRITES_PAUSED = "writesPaused";

function current(): ExecutionContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error("Convex syscall outside of a function execution");
  return ctx;
}

/** Remember engine failures: the function may turn them into its own error. */
function noting<T>(ctx: ExecutionContext, run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof SystemError) ctx.faults.first ??= error;
    throw error;
  }
}

/** Route the `convex/server` runtime's syscalls to the engine running the current function. */
function installSyscalls() {
  (globalThis as unknown as { Convex: unknown }).Convex = {
    syscall: (op: string, args: string) => {
      const ctx = current();
      return noting(ctx, () => ctx.engine.syscall(op, JSON.parse(args)));
    },
    asyncSyscall: async (op: string, args: string) => {
      const ctx = current();
      try {
        return await ctx.engine.asyncSyscall(op, JSON.parse(args));
      } catch (error) {
        if (error instanceof SystemError) ctx.faults.first ??= error;
        throw error;
      }
    },
    jsSyscall: (op: string) => {
      throw new Error(`Unsupported Convex syscall ${op}`);
    },
  };
}

export function canonicalPath(path: string): string {
  const pieces = path.split(":");
  let moduleName = pieces.length === 1 ? pieces[0] : pieces.slice(0, -1).join(":");
  const functionName = pieces.length === 1 ? "default" : pieces[pieces.length - 1];
  if (moduleName.endsWith(".js")) moduleName = moduleName.slice(0, -3);
  return `${moduleName}:${functionName}`;
}

function kindOf(fn: RegisteredFunction): FunctionKind | null {
  if (fn.isQuery) return "query";
  if (fn.isMutation) return "mutation";
  if (fn.isAction) return "action";
  return null;
}

function requestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isConvexError(error: unknown): error is Error & { data: unknown } {
  return typeof error === "object" && error !== null && Symbol.for("ConvexError") in error;
}

/**
 * Errors crossing a `ctx.run*` boundary: `performAsyncSyscall` rebuilds a
 * ConvexError from `error.data` (JSON), so pass application data through.
 */
async function nestedErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isConvexError(error)) {
      const data =
        typeof error.data === "string"
          ? JSON.parse(error.data)
          : convexToJson((error.data ?? null) as Value);
      throw Object.assign(new Error(error.message), { data });
    }
    throw error;
  }
}

/** The reference shapes `getFunctionAddress` produces for run/schedule syscalls. */
function addressName(args: { name?: string; reference?: string; functionHandle?: string }): string {
  if (typeof args.name === "string") return canonicalPath(args.name);
  throw new Error("Only named Convex function references are supported");
}

export type EngineOptions = {
  sql: Sql;
  schemaExport: string | null;
  modules: Modules;
  /** Reveal server error messages to clients (Convex dev deployments); prod redacts them. */
  exposeErrors?: boolean;
  now?: () => number;
  onCommit?: (commit: CommitInfo) => void;
};

type CommitOptions = {
  writer: Writer;
  log?: { session: string; request: number; result: string };
  meta?: Map<string, string>;
  /** More statements for the same SQL transaction (imports). */
  extra?: () => void;
  /** Runs once the transaction has committed, before commit listeners. */
  after?: () => void;
};

export class Engine {
  readonly store: Store;
  private modules: Modules;
  private exposeErrors: boolean;
  private now: () => number;
  private onCommit?: (commit: CommitInfo) => void;
  private lastTs: bigint;
  private mutationChain: Promise<unknown> = Promise.resolve();
  // Snapshot isolation: queries may await between reads, so a commit waits for
  // running readers and new readers wait for a pending commit. Every query (and
  // every sync transition) therefore observes exactly one committed state.
  private readers = 0;
  private committing = false;
  private readersDrained: Array<() => void> = [];
  private commitDone: Array<() => void> = [];
  // The write barrier: the mode, the epoch units are admitted in (it advances
  // every time writes pause) and the units of the current epoch still running.
  private mode: WriteMode;
  private epoch = 0;
  private units = new Set<Unit>();
  private idle: Array<() => void> = [];

  constructor(options: EngineOptions) {
    const schema = schemaInfoFromExport(options.schemaExport);
    this.store = new Store(guarded(options.sql), schema);
    this.store.init();
    this.modules = options.modules;
    this.exposeErrors = options.exposeErrors ?? false;
    this.now = options.now ?? Date.now;
    this.onCommit = options.onCommit;
    this.lastTs = BigInt(this.store.getMeta("ts") ?? "0");
    this.mode = this.store.getMeta(WRITES_PAUSED) === "1" ? "paused" : "live";
    installSyscalls();
  }

  setCommitListener(listener: (commit: CommitInfo) => void) {
    this.onCommit = listener;
  }

  /** Latest committed timestamp (nanoseconds, monotonic). */
  get ts(): bigint {
    return this.lastTs;
  }

  // ------------------------------------------------------------ write barrier

  get writeMode(): WriteMode {
    return this.mode;
  }

  /** True while a unit admitted since the last pause is still running. */
  get busy(): boolean {
    return this.units.size > 0;
  }

  /**
   * Admit one unit of work. Client and cron work needs `live`; scheduled jobs
   * may also start while draining, so the pause can settle the queue.
   */
  admit(source: "external" | "scheduled", label: string): Unit {
    if (this.mode === "paused" || (this.mode === "draining" && source === "external"))
      throw new WritesPausedError(label);
    const unit: Unit = { epoch: this.epoch, label };
    this.units.add(unit);
    return unit;
  }

  release(unit: Unit): void {
    this.units.delete(unit);
    if (this.units.size === 0) for (const resolve of this.idle.splice(0)) resolve();
  }

  /** Resolve once no admitted unit is running, or after `ms`. */
  whenIdle(ms: number): Promise<void> {
    if (this.units.size === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.idle.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Pause a database that has never been paused or resumed (a new one). */
  pauseIfNew(): void {
    if (this.store.getMeta(WRITES_PAUSED) === null) this.fence();
  }

  /** Stop admitting client and cron work; admitted units and due jobs may finish. */
  beginDrain(): void {
    if (this.mode !== "live") return;
    this.store.setMeta(WRITES_PAUSED, "1");
    this.mode = "draining";
  }

  /**
   * Pause now: from this call on, no unit's write lands, not even one admitted
   * before it (its epoch is over). Only system writes still commit.
   */
  fence(): void {
    this.store.setMeta(WRITES_PAUSED, "1");
    if (this.mode === "paused") return;
    this.mode = "paused";
    this.epoch++;
    this.units.clear();
    for (const resolve of this.idle.splice(0)) resolve();
  }

  /** Accept writes again, after any import still holding the write lock. */
  resume(): Promise<void> {
    return this.exclusive(async () => {
      this.store.setMeta(WRITES_PAUSED, "0");
      this.mode = "live";
    });
  }

  private authorize(writer: Writer): void {
    if (writer === SYSTEM) return;
    if (this.mode === "paused" || writer.epoch !== this.epoch)
      throw new WritesPausedError(writer.label);
  }

  // ---------------------------------------------------------------- functions

  resolve(
    path: string,
    kind: FunctionKind | null,
    visibility: Visibility,
  ): { fn: RegisteredFunction; path: string; kind: FunctionKind } {
    const canonical = canonicalPath(path);
    const separator = canonical.lastIndexOf(":");
    const moduleName = canonical.slice(0, separator);
    const exportName = canonical.slice(separator + 1);
    const candidate = this.modules[moduleName]?.[exportName] as RegisteredFunction | undefined;
    const fnKind = candidate && typeof candidate === "function" ? kindOf(candidate) : null;
    if (
      !candidate ||
      !fnKind ||
      (kind && fnKind !== kind) ||
      (visibility === "public" && !candidate.isPublic)
    ) {
      const label = kind ?? "function";
      throw new Error(
        `Could not find public ${label} for '${canonical}'. Did you forget to run \`npx convex dev\` or \`npx convex deploy\`?`,
      );
    }
    return { fn: candidate, path: canonical, kind: fnKind };
  }

  private validateArgs(fn: RegisteredFunction, path: string, args: Record<string, Value>) {
    const validator = JSON.parse(fn.exportArgs()) as ValidatorJSON;
    try {
      check(validator, args, (id, table) => this.store.isId(id, table));
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(`ArgumentValidationError: ${error.message} (function ${path})`);
      }
      throw error;
    }
  }

  private validateReturn(fn: RegisteredFunction, path: string, value: Value) {
    const exported = fn.exportReturns?.();
    if (!exported) return;
    const validator = JSON.parse(exported) as ValidatorJSON | null;
    if (!validator) return;
    try {
      check(validator, value, (id, table) => this.store.isId(id, table));
    } catch (error) {
      if (error instanceof ValidationError)
        throw new Error(`ReturnsValidationError: ${error.message} (function ${path})`);
      throw error;
    }
  }

  /**
   * Map any thrown value to what Convex shows clients: production redacts every
   * message to "Server Error" (keeping only ConvexError `data`); development
   * deployments (`exposeErrors`) include the message. The full error is logged.
   */
  clientError(error: unknown): ClientError {
    const rid = requestId();
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[Request ID: ${rid}] ${message}`);
    const detail = this.exposeErrors ? `\nUncaught ${message}` : "";
    if (isConvexError(error)) {
      const data =
        typeof error.data === "string"
          ? (JSON.parse(error.data) as JSONValue)
          : convexToJson((error.data ?? null) as Value);
      return { errorMessage: `[Request ID: ${rid}] Server Error${detail}`, errorData: data };
    }
    return { errorMessage: `[Request ID: ${rid}] Server Error${detail}`, errorData: undefined };
  }

  /** Run `fn` against one committed state; use `executeQuery` inside it. Not re-entrant. */
  async snapshot<T>(fn: () => Promise<T>): Promise<T> {
    while (this.committing) await new Promise<void>((resolve) => this.commitDone.push(resolve));
    this.readers++;
    try {
      return await fn();
    } finally {
      this.readers--;
      if (this.readers === 0) for (const resolve of this.readersDrained.splice(0)) resolve();
    }
  }

  runQuery(
    path: string,
    args: Record<string, Value>,
    identity: Identity | null,
    options: { visibility?: Visibility; readSet?: ReadEntry[] } = {},
  ): Promise<Value> {
    return this.snapshot(() => this.executeQuery(path, args, identity, options));
  }

  private context(
    kind: FunctionKind,
    identity: Identity | null,
    unit: Unit | null,
    extra: Partial<ExecutionContext> = {},
  ): ExecutionContext {
    return {
      engine: this,
      kind,
      identity,
      unit,
      txn: null,
      readSet: null,
      streams: new Map(),
      nextStream: 0,
      faults: {},
      ...extra,
    };
  }

  /** Run a query without taking the snapshot lock; the caller must hold it. */
  async executeQuery(
    path: string,
    args: Record<string, Value>,
    identity: Identity | null,
    options: { visibility?: Visibility; readSet?: ReadEntry[] } = {},
  ): Promise<Value> {
    const { fn, path: canonical } = this.resolve(path, "query", options.visibility ?? "public");
    this.validateArgs(fn, canonical, args);
    const ctx = this.context("query", identity, null, { readSet: options.readSet ?? null });
    const result = await als.run(ctx, () => fn.invokeQuery!(JSON.stringify(convexToJson([args]))));
    const value = jsonToConvex(JSON.parse(result));
    this.validateReturn(fn, canonical, value);
    return value;
  }

  /** Run `fn` with exclusive write access; mutations never interleave. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutationChain.then(fn, fn);
    this.mutationChain = run.catch(() => undefined);
    return run;
  }

  /**
   * Run a mutation. Without `unit` it is a client request, admitted only while
   * live; scheduled jobs and actions pass the unit they run for.
   */
  async runMutation(
    path: string,
    args: Record<string, Value>,
    identity: Identity | null,
    options: {
      visibility?: Visibility;
      dedupe?: { session: string; request: number };
      unit?: Unit;
      /** Extra writes committed atomically with the mutation (e.g. job state). */
      onSuccess?: (set: WriteSet) => void;
    } = {},
  ): Promise<{ value: Value; ts: bigint }> {
    return this.exclusive(async () => {
      if (options.dedupe) {
        const logged = this.store.loggedMutation(options.dedupe.session, options.dedupe.request);
        if (logged)
          return { value: jsonToConvex(JSON.parse(logged.result)), ts: BigInt(logged.ts) };
      }
      const unit = options.unit ?? this.admit("external", path);
      try {
        this.authorize(unit);
        const { fn, path: canonical } = this.resolve(
          path,
          "mutation",
          options.visibility ?? "public",
        );
        this.validateArgs(fn, canonical, args);
        const txn = new Transaction();
        const ctx = this.context("mutation", identity, unit, { txn });
        let result: string;
        try {
          result = await als.run(ctx, () =>
            fn.invokeMutation!(JSON.stringify(convexToJson([args]))),
          );
        } catch (error) {
          // A function that failed because the engine did is not a function error.
          throw ctx.faults.first ?? error;
        }
        const value = jsonToConvex(JSON.parse(result));
        this.validateReturn(fn, canonical, value);
        const meta = new Map<string, string>();
        options.onSuccess?.(this.writeSet(txn, meta));
        const ts = await this.commit(txn.writes(), {
          writer: unit,
          log: options.dedupe ? { ...options.dedupe, result } : undefined,
          meta,
        });
        return { value, ts };
      } finally {
        if (!options.unit) this.release(unit);
      }
    });
  }

  /**
   * Run an action. Without `unit` it is a client request, admitted only while
   * live; scheduled jobs and nested actions pass the unit they run for.
   */
  async runAction(
    path: string,
    args: Record<string, Value>,
    identity: Identity | null,
    options: { visibility?: Visibility; unit?: Unit } = {},
  ): Promise<Value> {
    const unit = options.unit ?? this.admit("external", path);
    try {
      this.authorize(unit);
      const { fn, path: canonical } = this.resolve(path, "action", options.visibility ?? "public");
      this.validateArgs(fn, canonical, args);
      const ctx = this.context("action", identity, unit);
      const result = await als.run(ctx, () =>
        fn.invokeAction!(requestId(), JSON.stringify(convexToJson([args]))),
      );
      const value = jsonToConvex(JSON.parse(result));
      this.validateReturn(fn, canonical, value);
      return value;
    } finally {
      if (!options.unit) this.release(unit);
    }
  }

  /** Run a function of any kind by path as a client request (operator `run`). */
  async runAny(path: string, args: Record<string, Value>): Promise<Value> {
    const { kind } = this.resolve(path, null, "internal");
    if (kind === "query") return this.runQuery(path, args, null, { visibility: "internal" });
    if (kind === "mutation")
      return (await this.runMutation(path, args, null, { visibility: "internal" })).value;
    return this.runAction(path, args, null, { visibility: "internal" });
  }

  private writeSet(txn: Transaction, meta: Map<string, string>): WriteSet {
    return {
      write: (table, id, after) => txn.set(id, table, after, () => this.store.getCommitted(id)),
      setMeta: (key, value) => meta.set(key, value),
    };
  }

  /** Commit a write set outside a user function (job bookkeeping, crons, recovery). */
  writeExclusive(writer: Writer, fn: (set: WriteSet) => void): Promise<bigint> {
    return this.exclusive(async () => {
      const txn = new Transaction();
      const meta = new Map<string, string>();
      fn(this.writeSet(txn, meta));
      return this.commit(txn.writes(), { writer, meta });
    });
  }

  /**
   * Replace stored state in one system commit, only while writes are paused
   * (imports and restores). `build` stages document writes and returns the
   * other statements of the same SQL transaction.
   */
  replaceState(build: (set: WriteSet) => () => void): Promise<bigint> {
    return this.exclusive(async () => {
      if (this.mode !== "paused") throw new NotPausedError();
      const txn = new Transaction();
      const meta = new Map<string, string>();
      const extra = build(this.writeSet(txn, meta));
      return this.commit(txn.writes(), {
        writer: SYSTEM,
        meta,
        extra,
        after: () => this.store.reload(),
      });
    });
  }

  private nextTs(): bigint {
    const wall = BigInt(Math.floor(this.now())) * 1_000_000n;
    this.lastTs = wall > this.lastTs ? wall : this.lastTs + 1n;
    return this.lastTs;
  }

  /** Apply a write set atomically once no query is reading. Callers hold the exclusive lock. */
  private async commit(writes: Map<string, Write>, options: CommitOptions): Promise<bigint> {
    this.committing = true;
    try {
      while (this.readers > 0)
        await new Promise<void>((resolve) => this.readersDrained.push(resolve));
      // Checked in the same synchronous turn as the write itself.
      this.authorize(options.writer);
      return this.apply(writes, options);
    } finally {
      this.committing = false;
      for (const resolve of this.commitDone.splice(0)) resolve();
    }
  }

  private apply(writes: Map<string, Write>, options: CommitOptions): bigint {
    const ts = this.nextTs();
    this.store.sql.transaction(() => {
      for (const write of writes.values())
        this.store.applyWrite(write.table, write.before, write.after);
      if (options.log)
        this.store.logMutation({ ...options.log, ts: ts.toString(), at: this.now() }, this.now());
      for (const [key, value] of options.meta ?? []) this.store.setMeta(key, value);
      options.extra?.();
      this.store.setMeta("ts", ts.toString());
    });
    options.after?.();
    if (writes.size > 0) this.onCommit?.({ ts, writes });
    return ts;
  }

  // ------------------------------------------------------------------ syscalls

  syscall(op: string, args: Record<string, unknown>): string {
    const ctx = current();
    switch (op) {
      case "1.0/queryStream": {
        const id = ctx.nextStream++;
        ctx.streams.set(id, this.stream(ctx, args.query as SerializedQuery));
        return JSON.stringify({ queryId: id });
      }
      case "1.0/queryCleanup":
        ctx.streams.delete(args.queryId as number);
        return JSON.stringify({});
      case "1.0/db/normalizeId": {
        const id = args.idString as string;
        return JSON.stringify({
          id:
            this.store.isId(id, args.table as string) && this.store.tableOf(id) !== null
              ? id
              : null,
        });
      }
      default:
        throw new Error(`Unsupported Convex syscall ${op}`);
    }
  }

  async asyncSyscall(op: string, args: Record<string, unknown>): Promise<string> {
    const ctx = current();
    switch (op) {
      case "1.0/get":
        return JSON.stringify(
          this.get(
            ctx,
            args.id as string,
            args.table as string | undefined,
            Boolean(args.isSystem),
          ),
        );
      case "1.0/queryStreamNext": {
        const stream = ctx.streams.get(args.queryId as number);
        if (!stream) throw new Error("Unknown query stream");
        const next = stream.next();
        return JSON.stringify(
          next.done
            ? { value: null, done: true }
            : { value: convexToJson(next.value as Value), done: false },
        );
      }
      case "1.0/queryPage":
        throw new Error(
          "Pagination (.paginate) is not supported by this backend; see docs/adr/0001-cloudflare-backend.md",
        );
      case "1.0/count": {
        const table = args.table as string;
        ctx.readSet?.push({ kind: "table", table });
        let count = this.store.countTable(table);
        for (const write of ctx.txn?.writes().values() ?? []) {
          if (write.table !== table) continue;
          count += (write.after ? 1 : 0) - (write.before ? 1 : 0);
        }
        return JSON.stringify(count);
      }
      case "1.0/insert":
        return JSON.stringify({
          _id: this.insert(
            ctx,
            args.table as string,
            jsonToConvex(args.value as JSONValue) as Record<string, Value>,
          ),
        });
      case "1.0/shallowMerge":
        this.patch(
          ctx,
          args.id as string,
          args.table as string | undefined,
          args.value as Record<string, JSONValue>,
          false,
        );
        return JSON.stringify({});
      case "1.0/replace":
        this.patch(
          ctx,
          args.id as string,
          args.table as string | undefined,
          args.value as Record<string, JSONValue>,
          true,
        );
        return JSON.stringify({});
      case "1.0/remove": {
        const txn = this.writable(ctx);
        const { table, doc } = this.existing(
          ctx,
          args.id as string,
          args.table as string | undefined,
          "Delete",
        );
        txn.set(doc._id, table, null, () => this.store.getCommitted(doc._id));
        return JSON.stringify({});
      }
      case "1.0/getUserIdentity":
        return JSON.stringify(ctx.identity);
      case "1.0/schedule":
        return JSON.stringify(this.schedule(this.writable(ctx), args));
      case "1.0/cancel_job":
        this.cancel(this.writable(ctx), args.id as string);
        return JSON.stringify({});
      case "1.0/actions/schedule": {
        let id = "";
        await this.writeExclusive(this.actionUnit(ctx, op), ({ write }) => {
          id = this.scheduleInto(write, args);
        });
        return JSON.stringify(id);
      }
      case "1.0/actions/cancel_job":
        await this.writeExclusive(this.actionUnit(ctx, op), ({ write }) => {
          const job = this.store.getCommitted(args.id as string);
          if (job && (job.state as { kind: string }).kind === "pending")
            write(SCHEDULED_FUNCTIONS, job._id, { ...job, state: { kind: "canceled" } } as Doc);
        });
        return JSON.stringify({});
      case "1.0/actions/query":
      case "1.0/actions/mutation":
      case "1.0/actions/action": {
        const unit = this.actionUnit(ctx, op);
        const path = addressName(args as { name?: string });
        const fnArgs = jsonToConvex(args.args as JSONValue) as Record<string, Value>;
        const visibility = "internal" as const;
        const value = await nestedErrors(() =>
          op === "1.0/actions/query"
            ? this.runQuery(path, fnArgs, ctx.identity, { visibility })
            : op === "1.0/actions/mutation"
              ? this.runMutation(path, fnArgs, ctx.identity, { visibility, unit }).then(
                  (result) => result.value,
                )
              : this.runAction(path, fnArgs, ctx.identity, { visibility, unit }),
        );
        return JSON.stringify(convexToJson(value));
      }
      case "1.0/runUdf":
        return JSON.stringify(convexToJson(await nestedErrors(() => this.runNested(ctx, args))));
      default:
        throw new Error(`Unsupported Convex syscall ${op}`);
    }
  }

  private actionUnit(ctx: ExecutionContext, op: string): Unit {
    if (ctx.kind !== "action" || !ctx.unit) throw new Error(`${op} is only available in actions`);
    return ctx.unit;
  }

  private writable(ctx: ExecutionContext): Transaction {
    if (ctx.kind !== "mutation" || !ctx.txn)
      throw new Error("Writes are only allowed in mutations");
    return ctx.txn;
  }

  private read(ctx: ExecutionContext, id: string): Doc | null {
    const pending = ctx.txn?.lookup(id);
    if (pending) return pending.after;
    return this.store.getCommitted(id);
  }

  private get(
    ctx: ExecutionContext,
    id: string,
    table: string | undefined,
    isSystem: boolean,
  ): JSONValue {
    if (!decodeDocumentId(id))
      throw new Error(`Invalid argument \`id\` for \`db.get\`: "${id}" is not a valid ID`);
    const owner = this.store.tableOf(id);
    if (table !== undefined && owner !== null && owner !== table) {
      throw new Error(
        `Invalid argument \`id\` for \`db.get\`: ID belongs to table "${owner}", not "${table}"`,
      );
    }
    ctx.readSet?.push({ kind: "get", id });
    if (owner === null) return null;
    if (owner.startsWith("_") !== isSystem) {
      throw new Error(
        isSystem
          ? "db.system.get can only read system tables"
          : "System tables can only be read through db.system.get",
      );
    }
    const doc = this.read(ctx, id);
    return doc ? convexToJson(doc as Value) : null;
  }

  private existing(
    ctx: ExecutionContext,
    id: string,
    table: string | undefined,
    verb: string,
  ): { table: string; doc: Doc } {
    const owner = this.store.tableOf(id);
    if (owner === null || (table !== undefined && owner !== table))
      throw new Error(`${verb} on invalid document ID "${id}"`);
    if (owner.startsWith("_")) throw new Error("System tables (prefixed with `_`) are read-only.");
    const doc = this.read(ctx, id);
    if (!doc) throw new Error(`${verb} on nonexistent document ID ${id}`);
    return { table: owner, doc };
  }

  private insert(ctx: ExecutionContext, table: string, value: Record<string, Value>): string {
    const txn = this.writable(ctx);
    if (table.startsWith("_")) throw new Error("System tables (prefixed with `_`) are read-only.");
    if ("_id" in value || "_creationTime" in value)
      throw new Error("System fields `_id` and `_creationTime` cannot be set on insert");
    const id = this.store.newId(table);
    const doc = {
      ...value,
      _id: id,
      _creationTime: this.store.nextCreationTime(this.now()),
    } as Doc;
    this.store.validate(table, doc);
    txn.set(id, table, doc, () => null);
    return id;
  }

  private patch(
    ctx: ExecutionContext,
    id: string,
    table: string | undefined,
    value: Record<string, JSONValue>,
    replace: boolean,
  ) {
    const txn = this.writable(ctx);
    const { table: owner, doc } = this.existing(ctx, id, table, replace ? "Replace" : "Update");
    const next: Record<string, Value> = replace ? {} : { ...doc };
    for (const [field, json] of Object.entries(value)) {
      const fieldValue = jsonToConvexOrUndefined(json);
      if (field === "_id" || field === "_creationTime") {
        if (fieldValue !== undefined && fieldValue !== doc[field]) {
          throw new Error(`Provided \`${field}\` field value does not match the document`);
        }
        continue;
      }
      if (fieldValue === undefined) delete next[field];
      else next[field] = fieldValue;
    }
    const updated = { ...next, _id: doc._id, _creationTime: doc._creationTime } as Doc;
    this.store.validate(owner, updated);
    txn.set(id, owner, updated, () => this.store.getCommitted(id));
  }

  /** A new pending `_scheduled_functions` record for a mutation or action. */
  newJob(path: string, args: Value, scheduledTime: number): Doc {
    const { path: canonical, kind } = this.resolve(path, null, "internal");
    if (kind === "query")
      throw new Error(`Cannot schedule query ${canonical}; schedule a mutation or action`);
    return {
      _id: this.store.newId(SCHEDULED_FUNCTIONS),
      _creationTime: this.store.nextCreationTime(this.now()),
      name: canonical,
      args: [args],
      scheduledTime,
      state: { kind: "pending" },
    } as Doc;
  }

  private scheduleInto(
    write: (table: string, id: string, after: Doc | null) => void,
    args: Record<string, unknown>,
  ): string {
    const job = this.newJob(
      addressName(args as { name?: string }),
      jsonToConvex(args.args as JSONValue),
      (args.ts as number) * 1000,
    );
    write(SCHEDULED_FUNCTIONS, job._id, job);
    return job._id;
  }

  private schedule(txn: Transaction, args: Record<string, unknown>): string {
    return this.scheduleInto((table, id, after) => txn.set(id, table, after, () => null), args);
  }

  private cancel(txn: Transaction, id: string) {
    const pending = txn.lookup(id);
    const job = pending ? pending.after : this.store.getCommitted(id);
    if (job && (job.state as { kind: string }).kind === "pending") {
      txn.set(id, SCHEDULED_FUNCTIONS, { ...job, state: { kind: "canceled" } } as Doc, () =>
        this.store.getCommitted(id),
      );
    }
  }

  private async runNested(ctx: ExecutionContext, args: Record<string, unknown>): Promise<Value> {
    const path = addressName(args as { name?: string });
    const fnArgs = jsonToConvex(args.args as JSONValue) as Record<string, Value>;
    const udfType = args.udfType as string;
    const kind = udfType === "mutation" ? "mutation" : "query";
    if (kind === "mutation" && ctx.kind !== "mutation")
      throw new Error("runMutation is only available in mutations and actions");
    const { fn, path: canonical } = this.resolve(path, kind, "internal");
    this.validateArgs(fn, canonical, fnArgs);
    const nested: ExecutionContext = { ...ctx, kind, streams: new Map(), nextStream: 0 };
    const argsJson = JSON.stringify(convexToJson([fnArgs]));
    if (kind === "query") {
      return jsonToConvex(JSON.parse(await als.run(nested, () => fn.invokeQuery!(argsJson))));
    }
    ctx.txn!.push();
    try {
      const result = jsonToConvex(
        JSON.parse(await als.run(nested, () => fn.invokeMutation!(argsJson))),
      );
      ctx.txn!.pop(true);
      return result;
    } catch (error) {
      ctx.txn!.pop(false);
      throw error;
    }
  }

  // -------------------------------------------------------------------- queries

  private source(query: SerializedQuery): { index: IndexDef; range: Range; order: "asc" | "desc" } {
    const source = query.source;
    if (source.type === "FullTableScan") {
      return {
        index: indexesFor(this.store.schema, source.tableName)[0],
        range: { lower: "", upper: KEY_MAX_SUFFIX },
        order: source.order ?? "asc",
      };
    }
    if (source.type === "IndexRange") {
      const [table, indexName] = source.indexName.split(".");
      const index = indexesFor(this.store.schema, table).find(
        (candidate) => candidate.name === `${table}.${indexName}`,
      );
      if (!index) throw new Error(`Index ${source.indexName} not found.`);
      const range = (
        source.range as Array<{ type: string; fieldPath: string; value: JSONValue }>
      ).map((expr) => ({
        type: expr.type,
        fieldPath: expr.fieldPath,
        value: jsonToConvexOrUndefined(expr.value),
      })) as SerializedRange;
      return { index, range: keyRange(index, range), order: source.order ?? "asc" };
    }
    throw new Error("Search indexes are not supported by this backend");
  }

  /** Index range scan merged with the transaction's own writes. */
  private *scanWithWrites(
    ctx: ExecutionContext,
    index: IndexDef,
    range: Range,
    order: "asc" | "desc",
  ): Generator<{ key: string; doc: Doc }> {
    const writes = [...(ctx.txn?.writes() ?? new Map<string, Write>()).entries()].filter(
      ([, write]) => write.table === index.table,
    );
    const shadowed = new Set(writes.map(([id]) => id));
    const pending = writes
      .filter(([, write]) => write.after !== null)
      .map(([, write]) => ({ key: documentKey(index, write.after!), doc: write.after! }))
      .filter(({ key }) => key >= range.lower && key < range.upper)
      .sort((a, b) => (a.key < b.key ? -1 : 1) * (order === "asc" ? 1 : -1));
    let next = 0;
    const before = (a: string, b: string) => (order === "asc" ? a < b : a > b);
    for (const entry of this.store.scan(index, range, order)) {
      if (shadowed.has(entry.doc._id)) continue;
      while (next < pending.length && before(pending[next].key, entry.key)) yield pending[next++];
      yield entry;
    }
    while (next < pending.length) yield pending[next++];
  }

  private *stream(ctx: ExecutionContext, query: SerializedQuery): Generator<Doc> {
    const { index, range, order } = this.source(query);
    ctx.readSet?.push({ kind: "range", index, range });
    const operators = query.operators;
    const limits = operators.map((op) => ("limit" in op ? op.limit : Infinity));
    const passed = operators.map(() => 0);
    outer: for (const { doc } of this.scanWithWrites(ctx, index, range, order)) {
      for (let i = 0; i < operators.length; i++) {
        const op = operators[i];
        if ("filter" in op) {
          if (!matchesFilter(op.filter, doc)) continue outer;
        } else {
          if (passed[i] >= limits[i]) return;
          passed[i]++;
        }
      }
      yield doc;
    }
  }
}

type SerializedQuery = {
  source:
    | { type: "FullTableScan"; tableName: string; order: "asc" | "desc" | null }
    | { type: "IndexRange"; indexName: string; range: unknown[]; order: "asc" | "desc" | null }
    | { type: "Search"; indexName: string };
  operators: Array<{ filter: JSONValue } | { limit: number }>;
};
