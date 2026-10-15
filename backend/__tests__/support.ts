/**
 * Test support: in-memory engines, a synthetic RS256 issuer, and an
 * in-process WebSocket so the real `convex@1.45` clients talk to SyncSession.
 */
import { AuthVerifier, type AuthProvider } from "../src/engine/auth";
import { Engine, type Modules } from "../src/engine/engine";
import { handleHttpApi } from "../src/protocol/http";
import { SyncSession } from "../src/protocol/sync";
import { memorySql } from "./sqlite";

/** `schema` is a `defineSchema(...)` result; its `export()` is not in the public type. */
export function makeEngine(schema: unknown, modules: Modules, options: { now?: () => number; exposeErrors?: boolean } = {}) {
  const schemaExport = schema ? (schema as { export(): string }).export() : null;
  return new Engine({ sql: memorySql(), schemaExport, modules, ...options });
}

const base64url = (data: Uint8Array | string) => Buffer.from(data).toString("base64url");

/** An RS256 token issuer whose JWKS (or OIDC discovery) is served from memory. */
export async function syntheticIssuer(issuer = "https://issuer.chrondle.test", kind: "customJwt" | "oidc" = "customJwt") {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", keyPair.publicKey)), kid: "synthetic-1", alg: "RS256", use: "sig" };
  const jwksUrl = `${issuer}/.well-known/jwks.json`;
  const provider: AuthProvider =
    kind === "customJwt"
      ? { type: "customJwt", issuer, jwks: jwksUrl, algorithm: "RS256", applicationID: "convex" }
      : { domain: issuer, applicationID: "convex" };
  const requests: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url === jwksUrl) return Response.json({ keys: [jwk] });
    if (url === `${issuer}/.well-known/openid-configuration`) return Response.json({ issuer, jwks_uri: jwksUrl });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  async function sign(claims: Record<string, unknown>, options: { key?: CryptoKey; header?: Record<string, unknown> } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = options.header ?? { alg: "RS256", kid: "synthetic-1", typ: "JWT" };
    const body = { iss: issuer, aud: "convex", iat: now, exp: now + 3600, ...claims };
    const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", options.key ?? keyPair.privateKey, new TextEncoder().encode(input));
    return `${input}.${base64url(new Uint8Array(signature))}`;
  }

  return {
    issuer,
    provider,
    jwks: { keys: [jwk] },
    fetchFn,
    requests,
    sign,
    verifier: (now?: () => number) => new AuthVerifier([provider], fetchFn, now),
  };
}

type Handler = ((event: unknown) => void) | null;

/**
 * Serves SyncSessions to in-process sockets. Network faults are simulated by
 * `dropAll()` (abrupt close), `offline` (connections refused) and
 * `dropOutgoing` (server messages lost in transit).
 */
export class InProcessServer {
  readonly sessions = new Set<SyncSession>();
  readonly sockets = new Set<InProcessSocket>();
  readonly fromClients: Array<Record<string, unknown>> = [];
  offline = false;
  dropOutgoing: ((message: Record<string, unknown>) => boolean) | null = null;

  constructor(
    readonly engine: Engine,
    readonly verifier: AuthVerifier,
  ) {
    engine.setCommitListener((commit) => {
      for (const session of this.sessions) session.invalidate(commit);
    });
  }

  get WebSocket(): typeof WebSocket {
    const server = this;
    return class extends InProcessSocket {
      constructor(url: string) {
        super(server, url);
      }
    } as unknown as typeof WebSocket;
  }

  /** `fetch` that serves the Convex HTTP API from this engine. */
  readonly fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const kind = new URL(request.url).pathname.replace("/api/", "") as "query" | "mutation" | "action";
    return handleHttpApi(request, kind, this.engine, this.verifier);
  }) as typeof fetch;

  dropAll() {
    for (const socket of [...this.sockets]) socket.terminate(1006, "network lost");
  }
}

class InProcessSocket {
  onopen: Handler = null;
  onmessage: Handler = null;
  onclose: Handler = null;
  onerror: Handler = null;
  readyState = 0;
  private session: SyncSession | null = null;

  constructor(
    private readonly server: InProcessServer,
    readonly url: string,
  ) {
    if (server.offline) {
      setTimeout(() => {
        this.readyState = 3;
        this.onerror?.({ message: "offline" });
        this.onclose?.({ code: 1006, reason: "offline", wasClean: false });
      }, 0);
      return;
    }
    server.sockets.add(this);
    const session = new SyncSession(server.engine, server.verifier, {
      send: (text) => {
        if (server.dropOutgoing?.(JSON.parse(text))) return;
        setTimeout(() => {
          if (this.readyState === 1) this.onmessage?.({ data: text });
        }, 0);
      },
      close: (code, reason) => this.terminate(code, reason),
    });
    this.session = session;
    server.sessions.add(session);
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.({});
    }, 0);
  }

  send(data: string) {
    if (this.readyState !== 1 || !this.session) return;
    this.server.fromClients.push(JSON.parse(data));
    const session = this.session;
    queueMicrotask(() => session.receive(data));
  }

  close() {
    this.terminate(1000, "");
  }

  terminate(code: number, reason: string) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    if (this.session) {
      this.session.closed = true;
      this.server.sessions.delete(this.session);
    }
    this.server.sockets.delete(this);
    setTimeout(() => this.onclose?.({ code, reason, wasClean: code === 1000 }), 0);
  }
}

/** Resolve when `predicate` holds, polling briefly. */
export async function eventually<T>(read: () => T | Promise<T>, predicate: (value: T) => boolean, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (predicate(value)) return value;
    if (Date.now() > deadline) throw new Error(`Timed out; last value ${JSON.stringify(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
