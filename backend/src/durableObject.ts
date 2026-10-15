/**
 * The only Durable Object: owns the SQLite document store, serves every
 * Convex client socket and HTTP call, and drives scheduled functions, crons
 * and backups from its alarm.
 */
import { DurableObject } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import schema from "../../convex/schema";
import authConfig from "../../convex/auth.config";
import * as crons from "../../convex/crons";
import { convexModules } from "./convexModules.gen";
import { AuthVerifier, type AuthProvider } from "./engine/auth";
import {
  mismatches,
  parse,
  readState,
  restore,
  serialize,
  summarize,
  SnapshotMismatchError,
  summarySchema,
  type Snapshot,
  type Summary,
} from "./engine/backup";
import { Engine, NotPausedError, SystemError, type CommitInfo } from "./engine/engine";
import { parseCrons, Scheduler } from "./engine/scheduler";
import { SCHEDULED_FUNCTIONS, type Sql, type SqlValue } from "./engine/store";
import { handleHttpApi } from "./protocol/http";
import { SyncSession } from "./protocol/sync";

export interface Env {
  BACKEND: DurableObjectNamespace<ChrondleBackend>;
  BACKUPS?: R2Bucket;
  ENVIRONMENT?: string;
  REVISION?: string;
  EXPOSE_ERRORS?: string;
  /** JSON array of extra auth providers; honoured outside production only (synthetic previews). */
  EXTRA_AUTH_PROVIDERS?: string;
  BACKEND_ADMIN_TOKEN?: string;
}

const PING_MS = 15_000;
const BACKUP_PREFIX = "backups/";
const BACKUPS_KEPT = 30;
/** How long a pause waits for admitted work and due jobs before it cuts them off. */
const SETTLE_MS = 60_000;
const SETTLE_MAX_MS = 15 * 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function authProviders(env: Env): AuthProvider[] {
  const providers = [...(authConfig.providers as AuthProvider[])];
  if (env.EXTRA_AUTH_PROVIDERS) {
    if (env.ENVIRONMENT === "production") {
      console.error("EXTRA_AUTH_PROVIDERS is ignored in production");
    } else {
      providers.push(...(JSON.parse(env.EXTRA_AUTH_PROVIDERS) as AuthProvider[]));
    }
  }
  return providers;
}

async function sameSecret(given: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(given)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

const logFailure = (label: string) => (error: unknown) => console.error(`[${label}]`, error);

export class ChrondleBackend extends DurableObject<Env> {
  private engine: Engine;
  private verifier: AuthVerifier;
  private scheduler: Scheduler;
  private sessions = new Set<SyncSession>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  // Serialize maintenance end-to-end, including R2 reads and drain bookkeeping.
  // A concurrent resume cannot overtake a pause, export, import or restore.
  private maintenanceChain: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql: Sql = {
      exec: (query: string, ...params: SqlValue[]) =>
        ctx.storage.sql.exec(query, ...params).toArray() as Record<string, SqlValue>[],
      transaction: (fn) => ctx.storage.transactionSync(fn),
    };
    this.engine = new Engine({
      sql,
      schemaExport: (schema as unknown as { export(): string }).export(),
      modules: convexModules,
      exposeErrors: env.EXPOSE_ERRORS === "1",
    });
    this.engine.setCommitListener((commit) => this.onCommit(commit));
    // A new production database refuses writes until its data has been imported
    // and an operator resumes it, so nothing (not even a cron) writes ahead of
    // the migration (docs/adr/0001-cloudflare-backend.md, data migration).
    if (env.ENVIRONMENT === "production") this.engine.pauseIfNew();
    this.verifier = new AuthVerifier(authProviders(env));
    this.scheduler = new Scheduler(this.engine, parseCrons(crons as never));
    void ctx.blockConcurrencyWhile(async () => {
      await this.scheduler.start();
      await this.arm();
    });
  }

  private onCommit(commit: CommitInfo) {
    for (const session of this.sessions) session.invalidate(commit);
    if ([...commit.writes.values()].some((write) => write.table === SCHEDULED_FUNCTIONS)) {
      // Start jobs due now without waiting for the alarm (which may be busy with a long action).
      this.scheduler.runDue().catch(logFailure("scheduler"));
      this.arm().catch(logFailure("alarm"));
    }
  }

  private async arm() {
    const next = this.scheduler.nextWakeTime();
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }

  /** A failure here throws, so Cloudflare retries the alarm with backoff. */
  async alarm() {
    if (this.engine.writeMode === "live") {
      await this.scheduler.runDue();
      await this.scheduler.prune();
    }
    await this.arm();
  }

  /** Watchdog from the Worker cron: make sure the next wake-up is armed. */
  async wake(): Promise<{ nextWake: number | null; ts: string }> {
    await this.arm();
    return { nextWake: this.scheduler.nextWakeTime(), ts: this.engine.ts.toString() };
  }

  /** Write a full snapshot plus its summary to the private R2 bucket. */
  async backup(): Promise<{ key: string; ts: string } & Summary> {
    if (!this.env.BACKUPS) throw new Error("BACKUPS bucket is not bound");
    // One synchronous turn: no commit can land between the summary and the body.
    const ts = this.engine.ts.toString();
    const state = readState(this.engine);
    const summary = summarize(state);
    const body = [...serialize(state)].join("");
    const key = `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`;
    await this.env.BACKUPS.put(key, body, {
      httpMetadata: { contentType: "application/x-ndjson" },
      customMetadata: { ts, revision: this.env.REVISION ?? "unknown" },
    });
    await this.env.BACKUPS.put(`${key}.manifest.json`, JSON.stringify({ ts, ...summary }), {
      httpMetadata: { contentType: "application/json" },
    });
    const listed = await this.env.BACKUPS.list({ prefix: BACKUP_PREFIX });
    const backups = listed.objects
      .map((object) => object.key)
      .filter((name) => name.endsWith(".ndjson"))
      .sort();
    for (const stale of backups.slice(0, Math.max(0, backups.length - BACKUPS_KEPT))) {
      await this.env.BACKUPS.delete([stale, `${stale}.manifest.json`]);
    }
    return { key, ts, ...summary };
  }

  /** Replace all state with a snapshot (writes must be paused) and verify it. */
  private async replaceWith(snapshot: Snapshot, expected = summarize(snapshot)): Promise<Response> {
    let stored: Summary;
    try {
      stored = await restore(this.engine, snapshot, expected);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status =
        error instanceof NotPausedError ? 409 : error instanceof SystemError ? 500 : 400;
      return json({ error: message, verified: false, mismatches: error instanceof SnapshotMismatchError ? error.mismatches : [] }, status);
    }
    const differences = mismatches(expected, stored);
    return json(
      {
        writes: this.engine.writeMode,
        ts: this.engine.ts.toString(),
        verified: differences.length === 0,
        mismatches: differences,
        ...stored,
      },
      differences.length ? 500 : 200,
    );
  }

  /**
   * Operator API behind BACKEND_ADMIN_TOKEN (the `npx convex run` / dashboard
   * equivalent). Unauthenticated callers get the same 404 as unknown paths.
   */
  private async admin(request: Request, path: string): Promise<Response> {
    const expected = this.env.BACKEND_ADMIN_TOKEN;
    const given = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    if (!expected || !given || !(await sameSecret(given, expected))) {
      await request.body?.cancel();
      return json({ error: "Not found" }, 404);
    }
    // Read the whole body before answering: replying while it still streams
    // breaks the connection that carries it.
    const body = request.body ? await request.text() : "";
    const route = `${request.method} ${path.slice("/_backend/admin".length)}`;
    const perform = () => this.adminOperation(route, body, request.headers);
    if (["POST /pause", "POST /resume", "GET /export", "POST /import", "POST /restore"].includes(route)) {
      const result = this.maintenanceChain.then(perform, perform);
      this.maintenanceChain = result.catch(() => undefined);
      return result;
    }
    return perform();
  }

  private async adminOperation(route: string, body: string, headers: Headers): Promise<Response> {
    const input = (): Record<string, JSONValue | undefined> => {
      try {
        const parsed: unknown = JSON.parse(body || "{}");
        return parsed !== null && typeof parsed === "object"
          ? (parsed as Record<string, JSONValue>)
          : {};
      } catch {
        return {};
      }
    };
    const writeState = () => ({ writes: this.engine.writeMode, ts: this.engine.ts.toString() });
    const requirePaused = () =>
      this.engine.writeMode === "paused"
        ? null
        : json({ error: "Pause writes first: POST /_backend/admin/pause" }, 409);
    switch (route) {
      case "GET /manifest":
        return json({ ...writeState(), ...summarize(readState(this.engine)) });
      case "POST /pause": {
        // A barrier: when it answers, nothing but an import can write.
        const { settleMs } = input();
        const wait =
          typeof settleMs === "number" ? Math.max(0, Math.min(settleMs, SETTLE_MAX_MS)) : SETTLE_MS;
        const report = await this.scheduler.pause(Date.now() + wait);
        return json({ ...writeState(), ...report });
      }
      case "POST /resume":
        await this.engine.resume();
        await this.arm();
        return json(writeState());
      case "GET /export": {
        // Only a paused backend exports for a migration: nothing lands after it.
        const refused = requirePaused();
        if (refused) return refused;
        const exported = [...serialize(readState(this.engine))].join("");
        return new Response(exported, {
          headers: {
            "Content-Type": "application/x-ndjson",
            "X-Backend-Ts": this.engine.ts.toString(),
            "X-Backend-Sha256": createHash("sha256").update(exported).digest("hex"),
          },
        });
      }
      case "POST /import": {
        const refused = requirePaused();
        if (refused) return refused;
        // An import must carry the sender's checksum, not just hash the received body.
        const expectedHash = headers.get("X-Backend-Sha256");
        if (!expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash) ||
            expectedHash !== createHash("sha256").update(body).digest("hex"))
          return json({ error: "Missing or mismatched X-Backend-Sha256", verified: false }, 400);
        let snapshot: Snapshot;
        try {
          snapshot = parse(body.split("\n"));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : String(error) }, 400);
        }
        return this.replaceWith(snapshot);
      }
      case "POST /backup":
        return json(await this.backup());
      case "POST /restore": {
        const refused = requirePaused();
        if (refused) return refused;
        const { key } = input();
        if (typeof key !== "string") return json({ error: "Missing key" }, 400);
        if (!this.env.BACKUPS) return json({ error: "BACKUPS bucket is not bound" }, 500);
        const [object, manifestObject] = await Promise.all([
          this.env.BACKUPS.get(key),
          this.env.BACKUPS.get(`${key}.manifest.json`),
        ]);
        if (!object || !manifestObject)
          return json({ error: `Backup ${key} or its manifest is missing` }, 404);
        let recorded: Summary;
        let snapshot: Snapshot;
        try {
          recorded = summarySchema.parse(JSON.parse(await manifestObject.text()));
          snapshot = parse((await object.text()).split("\n"));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : String(error) }, 400);
        }
        // The body must match what was recorded at backup time, and the store the body.
        return this.replaceWith(snapshot, recorded);
      }
      case "POST /run": {
        const { path: fnPath, args } = input();
        if (typeof fnPath !== "string") return json({ error: "Missing path" }, 400);
        try {
          const value = await this.engine.runAny(
            fnPath,
            jsonToConvex(args ?? {}) as Record<string, Value>,
          );
          return json({ status: "success", value: convexToJson(value) });
        } catch (error) {
          return json(
            {
              status: "error",
              error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            },
            500,
          );
        }
      }
      case "GET /scheduler":
        return json(this.scheduler.status());
      default:
        return json({ error: "Not found" }, 404);
    }
  }

  private connect(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return json({ error: "Expected a WebSocket upgrade" }, 426);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const session = new SyncSession(this.engine, this.verifier, {
      send: (message) => {
        try {
          server.send(message);
        } catch {
          session.closed = true;
        }
      },
      close: (code, reason) => {
        try {
          server.close(code, reason);
        } catch {
          // already closed
        }
      },
    });
    this.sessions.add(session);
    this.pingTimer ??= setInterval(() => {
      for (const s of this.sessions) s.ping();
    }, PING_MS);
    const drop = () => {
      session.closed = true;
      this.sessions.delete(session);
      if (this.sessions.size === 0 && this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
    };
    server.addEventListener("message", (event: MessageEvent) => {
      session.receive(
        typeof event.data === "string"
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer),
      );
    });
    server.addEventListener("close", drop);
    server.addEventListener("error", drop);
    return new Response(null, { status: 101, webSocket: client });
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (/^\/api\/[^/]+\/sync$/.test(path)) return this.connect(request);
    if (path === "/api/query") return handleHttpApi(request, "query", this.engine, this.verifier);
    if (path === "/api/mutation")
      return handleHttpApi(request, "mutation", this.engine, this.verifier);
    if (path === "/api/action") return handleHttpApi(request, "action", this.engine, this.verifier);
    if (path === "/_backend/version") {
      return json({
        service: "chrondle-backend",
        revision: this.env.REVISION ?? "development",
        environment: this.env.ENVIRONMENT ?? "development",
      });
    }
    if (path.startsWith("/_backend/admin/")) return this.admin(request, path);
    await request.body?.cancel();
    return json({ error: "Not found" }, 404);
  }
}
