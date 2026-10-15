/** Controlled R2 interleavings at the real admin consumer; SQLite is real. */
import { timingSafeEqual } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readState, serialize, summarize } from "../src/engine/backup";
import type { SqlValue } from "../src/engine/store";
import { makeEngine } from "./support";
import { memorySql } from "./sqlite";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(readonly ctx: unknown, readonly env: unknown) {}
  },
}));

import { ChrondleBackend, type Env } from "../src/durableObject";

// Workers extends SubtleCrypto with this native operation; Node exposes it separately.
beforeAll(() => Object.defineProperty(crypto.subtle, "timingSafeEqual", {
  configurable: true,
  value: (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b)),
}));
afterAll(() => { Reflect.deleteProperty(crypto.subtle, "timingSafeEqual"); });

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("end-to-end maintenance serialization", () => {
  it.each([false, true])("resume cannot overtake a suspended R2 restore (corrupt=%s)", async (corrupt) => {
    const sql = memorySql();
    let boot: Promise<unknown> = Promise.resolve();
    const entered = gate();
    const finish = gate();
    const empty = makeEngine(null, {});
    const snapshot = [...serialize(readState(empty))].join("");
    const summary = summarize(readState(empty));
    // The only stubbed service is Cloudflare's R2, to stop an actual admin restore
    // precisely between its initial pause check and its database replacement.
    const ctx = {
      storage: {
        sql: { exec: (query: string, ...params: SqlValue[]) => ({ toArray: () => sql.exec(query, ...params) }) },
        transactionSync: sql.transaction,
        setAlarm: async () => undefined,
      },
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => (boot = fn()),
    };
    const env = {
      ENVIRONMENT: "production",
      BACKEND_ADMIN_TOKEN: "synthetic-admin-boundary",
      BACKUPS: {
        get: async (key: string) => {
          if (key.endsWith(".manifest.json")) return { text: async () => JSON.stringify(summary) };
          entered.release();
          await finish.promise;
          // A malformed body must fail before any database changes.
          return { text: async () => corrupt ? "not snapshot JSON" : snapshot };
        },
      },
    };
    const backend = new ChrondleBackend(ctx as unknown as DurableObjectState, env as unknown as Env);
    await boot;
    const call = (path: string, body = {}) => backend.fetch(new Request(`https://backend.invalid/_backend/admin/${path}`, {
      method: "POST",
      headers: { Authorization: "Bearer synthetic-admin-boundary" },
      body: JSON.stringify(body),
    }));
    let resumed = false;
    const restoring = call("restore", { key: "synthetic.ndjson" });
    await Promise.race([entered.promise, restoring.then(() => { throw new Error("restore answered before reading R2"); })]);
    const resuming = call("resume").then((response) => { resumed = true; return response; });
    await sleep(20);
    const beforeRelease = resumed;
    finish.release();
    const [restored, resume] = await Promise.all([restoring, resuming]);
    expect(beforeRelease, "resume must queue behind the entire restore, not just its SQL commit").toBe(false);
    expect(restored.status).toBe(corrupt ? 400 : 200);
    expect(resume.status).toBe(200);
    expect(await resume.json()).toMatchObject({ writes: "live" });
    if (!corrupt) expect(await restored.json()).toMatchObject({ verified: true, writes: "paused" });
  });
});
