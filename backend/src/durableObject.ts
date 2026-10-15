/**
 * The only Durable Object: owns the SQLite document store, serves every
 * Convex client socket and HTTP call, and drives scheduled functions, crons
 * and backups from its alarm.
 */
import { DurableObject } from "cloudflare:workers";
import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import schema from "../../convex/schema";
import authConfig from "../../convex/auth.config";
import * as crons from "../../convex/crons";
import { convexModules } from "./convexModules.gen";
import { AuthVerifier, type AuthProvider } from "./engine/auth";
import { exportLines, restore, summarize, type Manifest } from "./engine/backup";
import { Engine, type CommitInfo } from "./engine/engine";
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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

export class ChrondleBackend extends DurableObject<Env> {
  private engine: Engine;
  private verifier: AuthVerifier;
  private scheduler: Scheduler;
  private sessions = new Set<SyncSession>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql: Sql = {
      exec: (query: string, ...params: SqlValue[]) => ctx.storage.sql.exec(query, ...params).toArray() as Record<string, SqlValue>[],
      transaction: (fn) => ctx.storage.transactionSync(fn),
    };
    this.engine = new Engine({
      sql,
      schemaExport: (schema as unknown as { export(): string }).export(),
      modules: convexModules,
      exposeErrors: env.EXPOSE_ERRORS === "1",
    });
    this.engine.setCommitListener((commit) => this.onCommit(commit));
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
      void this.scheduler.runDue();
      void this.arm();
    }
  }

  private async arm() {
    const next = this.scheduler.nextWakeTime();
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()));
  }

  async alarm() {
    await this.scheduler.runDue();
    const day = new Date().toISOString().slice(0, 10);
    if (this.engine.store.getMeta("jobsPrunedOn") !== day) {
      this.engine.store.setMeta("jobsPrunedOn", day);
      await this.scheduler.prune();
    }
    await this.arm();
  }

  /** Watchdog from the Worker cron: make sure the next wake-up is armed. */
  async wake(): Promise<{ nextWake: number | null; ts: string }> {
    await this.arm();
    return { nextWake: this.scheduler.nextWakeTime(), ts: this.engine.ts.toString() };
  }

  /** Write a full NDJSON backup plus its manifest to the private R2 bucket. */
  async backup(): Promise<{ key: string; ts: string; manifest: Manifest }> {
    if (!this.env.BACKUPS) throw new Error("BACKUPS bucket is not bound");
    // One synchronous turn: no commit can land between the manifest and the body.
    const ts = this.engine.ts.toString();
    const manifest = summarize(this.engine);
    const body = [...exportLines(this.engine)].join("");
    const key = `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`;
    await this.env.BACKUPS.put(key, body, {
      httpMetadata: { contentType: "application/x-ndjson" },
      customMetadata: { ts, revision: this.env.REVISION ?? "unknown" },
    });
    await this.env.BACKUPS.put(`${key}.manifest.json`, JSON.stringify({ ts, manifest }), { httpMetadata: { contentType: "application/json" } });
    const listed = await this.env.BACKUPS.list({ prefix: BACKUP_PREFIX });
    const backups = listed.objects.map((object) => object.key).filter((name) => name.endsWith(".ndjson")).sort();
    for (const stale of backups.slice(0, Math.max(0, backups.length - BACKUPS_KEPT))) {
      await this.env.BACKUPS.delete([stale, `${stale}.manifest.json`]);
    }
    return { key, ts, manifest };
  }

  /** Replace application data with a backup and check it against the backup's manifest. */
  private async restoreFrom(key: string): Promise<Response> {
    if (!this.env.BACKUPS) return json({ error: "BACKUPS bucket is not bound" }, 500);
    const [object, manifestObject] = await Promise.all([this.env.BACKUPS.get(key), this.env.BACKUPS.get(`${key}.manifest.json`)]);
    if (!object || !manifestObject) return json({ error: `Backup ${key} or its manifest is missing` }, 404);
    const expected = (JSON.parse(await manifestObject.text()) as { manifest: Manifest }).manifest;
    const manifest = await restore(this.engine, (await object.text()).split("\n"));
    const mismatches = [...new Set([...Object.keys(expected), ...Object.keys(manifest)])].filter(
      (table) => JSON.stringify(expected[table] ?? null) !== JSON.stringify(manifest[table] ?? null),
    );
    return json({ key, verified: mismatches.length === 0, mismatches, manifest, ts: this.engine.ts.toString() }, mismatches.length ? 500 : 200);
  }

  /**
   * Operator API behind BACKEND_ADMIN_TOKEN (the `npx convex run` / dashboard
   * equivalent). Unauthenticated callers get the same 404 as unknown paths.
   */
  private async admin(request: Request, path: string): Promise<Response> {
    const expected = this.env.BACKEND_ADMIN_TOKEN;
    const given = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    if (!expected || !given || !(await sameSecret(given, expected))) return json({ error: "Not found" }, 404);
    const route = `${request.method} ${path.slice("/_backend/admin".length)}`;
    switch (route) {
      case "GET /manifest":
        return json({ ts: this.engine.ts.toString(), manifest: summarize(this.engine) });
      case "POST /backup":
        return json(await this.backup());
      case "POST /restore": {
        const { key } = (await request.json()) as { key?: string };
        return key ? this.restoreFrom(key) : json({ error: "Missing key" }, 400);
      }
      case "POST /run": {
        const { path: fnPath, args } = (await request.json()) as { path?: string; args?: JSONValue };
        if (!fnPath) return json({ error: "Missing path" }, 400);
        try {
          const value = await this.engine.runAny(fnPath, jsonToConvex(args ?? {}) as Record<string, Value>);
          return json({ status: "success", value: convexToJson(value) });
        } catch (error) {
          return json({ status: "error", error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }, 500);
        }
      }
      case "GET /scheduler":
        return json(this.scheduler.status());
      default:
        return json({ error: "Not found" }, 404);
    }
  }

  private connect(request: Request): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "Expected a WebSocket upgrade" }, 426);
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
      session.receive(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer));
    });
    server.addEventListener("close", drop);
    server.addEventListener("error", drop);
    return new Response(null, { status: 101, webSocket: client });
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (/^\/api\/[^/]+\/sync$/.test(path)) return this.connect(request);
    if (path === "/api/query") return handleHttpApi(request, "query", this.engine, this.verifier);
    if (path === "/api/mutation") return handleHttpApi(request, "mutation", this.engine, this.verifier);
    if (path === "/api/action") return handleHttpApi(request, "action", this.engine, this.verifier);
    if (path === "/_backend/version") {
      return json({ service: "chrondle-backend", revision: this.env.REVISION ?? "development", environment: this.env.ENVIRONMENT ?? "development" });
    }
    if (path.startsWith("/_backend/admin/")) return this.admin(request, path);
    return json({ error: "Not found" }, 404);
  }
}
