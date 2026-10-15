/** Real admin consumer, SQLite and RSA signatures; only Access cert delivery is stubbed. */
import { timingSafeEqual } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { memorySql } from "./sqlite";
import { syntheticIssuer } from "./support";
import type { SqlValue } from "../src/engine/store";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));
import { ChrondleBackend, type Env } from "../src/durableObject";

// The baseline uses Workers' SubtleCrypto extension; Node exposes it separately.
beforeAll(() =>
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value: (a: ArrayBuffer, b: ArrayBuffer) =>
      timingSafeEqual(new Uint8Array(a), new Uint8Array(b)),
  }),
);
afterAll(() => {
  Reflect.deleteProperty(crypto.subtle, "timingSafeEqual");
});
afterEach(() => vi.unstubAllGlobals());

const issuerUrl = "https://operator-test.cloudflareaccess.com";
const audience = "synthetic-operator-audience";
const clientId = "named-migration-operator.access";
const email = "owner@example.test";
const config = {
  issuer: issuerUrl,
  audience,
  identities: [
    { kind: "human", email },
    { kind: "machine", clientId },
  ],
};
const human = { sub: "stable-human-id", email, type: "app" };
const machine = { sub: "", common_name: clientId, type: "app", email: undefined };

async function backend(settings: Record<string, string | undefined> = {}) {
  const issuer = await syntheticIssuer(issuerUrl);
  const fetchCerts = vi.fn(async (input: RequestInfo | URL) => {
    expect(String(input)).toBe(`${issuerUrl}/cdn-cgi/access/certs`);
    return Response.json(issuer.jwks, { headers: { "Cache-Control": "max-age=60" } });
  });
  vi.stubGlobal("fetch", fetchCerts);
  const sql = memorySql();
  let boot: Promise<unknown> = Promise.resolve();
  const ctx = {
    storage: {
      sql: {
        exec: (query: string, ...params: SqlValue[]) => ({
          toArray: () => sql.exec(query, ...params),
        }),
      },
      transactionSync: sql.transaction,
      setAlarm: async () => undefined,
    },
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => (boot = fn()),
  };
  const env = {
    ENVIRONMENT: "production",
    BACKEND_ADMIN_TOKEN: "synthetic-local-admin",
    BACKEND_OPERATOR_ACCESS: JSON.stringify(config),
    ...settings,
  };
  const instance = new ChrondleBackend(ctx as unknown as DurableObjectState, env as unknown as Env);
  await boot;
  const token = (claims: Record<string, unknown> = {}) =>
    issuer.sign({ ...human, aud: audience, ...claims });
  const request = (
    assertion?: string,
    path = "manifest",
    method = "GET",
    auth = "",
    origin = "https://backend.invalid",
  ) =>
    instance.fetch(
      new Request(`${origin}/_backend/admin/${path}`, {
        method,
        headers: {
          ...(auth ? { Authorization: auth } : {}),
          ...(assertion ? { "Cf-Access-Jwt-Assertion": assertion } : {}),
        },
      }),
    );
  return { instance, request, token, fetchCerts, issuer };
}

describe("hosted operator Access boundary", () => {
  it.each(["production", "preview"])(
    "allows exact signed human email and pinned machine ClientID in %s",
    async (ENVIRONMENT) => {
      const app = await backend({ ENVIRONMENT });
      for (const claims of [human, machine]) {
        const response = await app.request(await app.token(claims));
        expect(response.status).toBe(200);
        if (ENVIRONMENT === "production")
          expect(await response.json()).toMatchObject({ writes: "paused" });
      }
      expect(app.fetchCerts).toHaveBeenCalledOnce();
    },
  );

  it.each(["production", "preview", undefined, "prodution"])(
    "never falls back to bearer when environment=%s",
    async (ENVIRONMENT) => {
      const app = await backend({ ENVIRONMENT });
      expect(
        (await app.request(undefined, "manifest", "GET", "Bearer synthetic-local-admin")).status,
      ).toBe(404);
      expect(app.fetchCerts).not.toHaveBeenCalled();
    },
  );

  it.each([
    undefined,
    "not-json",
    JSON.stringify({ ...config, audience: "" }),
    JSON.stringify({ ...config, identities: [] }),
    JSON.stringify({ ...config, identities: [{ kind: "human", email: "" }] }),
    JSON.stringify({ ...config, identities: [{ kind: "machine", clientId: "" }] }),
    JSON.stringify({ ...config, identities: [{ kind: "unknown", clientId }] }),
    JSON.stringify({ ...config, issuer: "https://attacker.invalid" }),
    JSON.stringify({ ...config, issuer: issuerUrl + "/other" }),
    JSON.stringify({ ...config, unexpected: true }),
  ])(
    "fails closed on missing/malformed operator configuration (%#)",
    async (BACKEND_OPERATOR_ACCESS) => {
      const app = await backend({ BACKEND_OPERATOR_ACCESS });
      expect((await app.request(await app.token())).status).toBe(404);
      expect(app.fetchCerts).not.toHaveBeenCalled();
    },
  );

  it.each([
    { email: "unknown@example.test" },
    { email: "OWNER@example.test" },
    { email: undefined },
    { ...machine, common_name: "unknown.access" },
    { ...machine, common_name: undefined },
    { sub: "", email },
    { ...machine, sub: undefined },
    { ...machine, sub: 123 },
    { ...machine, type: "org" },
    { ...machine, type: undefined },
    { type: "org" },
    { aud: "another-application" },
    { ...machine, aud: "another-application" },
    { iss: "https://attacker.invalid" },
    { ...machine, iss: "https://attacker.invalid" },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { ...machine, exp: Math.floor(Date.now() / 1000) - 1 },
    { nbf: Math.floor(Date.now() / 1000) + 300 },
    { ...machine, nbf: Math.floor(Date.now() / 1000) + 300 },
  ])("rejects a correctly signed but unauthorized identity (%#)", async (claims) => {
    const app = await backend();
    expect((await app.request(await app.token(claims))).status).toBe(404);
  });

  it("uses human email, not a stale provider subject, as the exact human identity", async () => {
    const app = await backend();
    expect((await app.request(await app.token({ sub: "replacement-human-id" }))).status).toBe(200);
    expect((await app.request(await app.token({ email: "other@example.test" }))).status).toBe(404);
  });

  it("rejects malformed and tampered machine assertions without reflecting credentials", async () => {
    const app = await backend();
    const valid = await app.token(machine);
    for (const token of ["not-a-jwt", valid.slice(0, -8) + "AAAAAAAA"]) {
      const response = await app.request(token);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
  });

  it("does not allow an unauthorized resume to open the production writer", async () => {
    const app = await backend();
    expect((await app.request(undefined, "resume", "POST")).status).toBe(404);
    expect(await (await app.request(await app.token(machine))).json()).toMatchObject({
      writes: "paused",
    });
  });

  it("keeps empty-sub service assertions invalid for ordinary game auth", async () => {
    const app = await backend();
    const verifier = app.issuer.verifier();
    const serviceToken = await app.issuer.sign(machine);
    await expect(verifier.verify(serviceToken)).rejects.toThrow("subject");
  });

  it("keeps public version and unauthenticated game queries independent of operators", async () => {
    const app = await backend();
    expect(
      (await app.instance.fetch(new Request("https://backend.invalid/_backend/version"))).status,
    ).toBe(200);
    const response = await app.instance.fetch(
      new Request("https://backend.invalid/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "puzzles:getTotalPuzzles", args: {} }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "success", value: { count: 0 } });
    expect(app.fetchCerts).not.toHaveBeenCalled();
  });

  it("retains constant-time bearer access only on explicit loopback development", async () => {
    const app = await backend({ ENVIRONMENT: "development", BACKEND_OPERATOR_ACCESS: undefined });
    expect(
      (
        await app.request(
          undefined,
          "manifest",
          "GET",
          "Bearer synthetic-local-admin",
          "http://127.0.0.1:18417",
        )
      ).status,
    ).toBe(200);
    expect(
      (await app.request(undefined, "manifest", "GET", "Bearer wrong", "http://127.0.0.1:18417"))
        .status,
    ).toBe(404);
    expect(
      (await app.request(undefined, "manifest", "GET", "Bearer synthetic-local-admin")).status,
    ).toBe(404);
    expect(app.fetchCerts).not.toHaveBeenCalled();
  });
});
