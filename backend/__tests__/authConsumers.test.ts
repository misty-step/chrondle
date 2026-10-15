import { defineSchema, queryGeneric } from "convex/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthVerifier } from "../src/engine/auth";
import { handleHttpApi } from "../src/protocol/http";
import { SyncSession } from "../src/protocol/sync";
import { eventually, makeEngine, syntheticIssuer } from "./support";

vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }));
import { authProviders } from "../src/durableObject";

const NOW = Date.now();
let first: Awaited<ReturnType<typeof syntheticIssuer>>;
let rotated: typeof first;
beforeAll(async () => {
  first = await syntheticIssuer("https://oidc.example.test", "oidc");
  rotated = await syntheticIssuer(first.issuer, "oidc");
});
afterAll(() => vi.restoreAllMocks());

function fixture() {
  let now = NOW;
  let keys = first.jwks.keys;
  let unavailable = false;
  const policies = {
    discovery: { control: "public, max-age=3600", age: "0" },
    jwks: { control: "public, max-age=3600", age: "0" },
  };
  let keyFetchMs = 0;
  const bodyMs = { discovery: 0, jwks: 0 };
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    // Yield so concurrent requests overlap the refresh.
    await Promise.resolve();
    if (unavailable) return new Response(null, { status: 429 });
    const boundary = url.endsWith("openid-configuration") ? "discovery" : "jwks";
    if (boundary === "jwks") now += keyFetchMs;
    const policy = policies[boundary];
    const body = boundary === "discovery" ? { jwks_uri: `${first.issuer}/keys` } : { keys };
    const response = Response.json(body, {
      headers: { "Cache-Control": policy.control, Age: policy.age },
    });
    const json = response.json.bind(response);
    response.json = async () => {
      now += bodyMs[boundary];
      return json();
    };
    return response;
  }) as typeof fetch;
  const verifier = new AuthVerifier([first.provider], fetcher, () => now);
  const engine = makeEngine(defineSchema({}), {
    account: {
      who: queryGeneric({
        handler: async (ctx) => (await ctx.auth.getUserIdentity())?.subject ?? null,
      }),
    },
  });
  return {
    calls,
    verifier,
    engine,
    advance: (ms: number) => {
      now += ms;
    },
    revoke: () => {
      keys = [];
    },
    rotate: () => {
      keys = rotated.jwks.keys.map((key) => ({ ...key, kid: "rotated" }));
    },
    unavailable: (value: boolean) => {
      unavailable = value;
    },
    cache: (control: string, age = "0", boundary?: "discovery" | "jwks") => {
      for (const target of boundary ? [boundary] : (["discovery", "jwks"] as const)) {
        policies[target] = { control, age };
      }
    },
    delayKeys: (ms: number) => {
      keyFetchMs = ms;
    },
    delayBody: (boundary: "discovery" | "jwks", ms: number) => {
      bodyMs[boundary] = ms;
    },
  };
}

type Fixture = ReturnType<typeof fixture>;
async function consume(f: Fixture, token: string, kind: "http" | "sync") {
  if (kind === "http") {
    const response = await handleHttpApi(
      new Request("https://backend.test/api/query", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: "account:who", args: [{}] }),
      }),
      "query",
      f.engine,
      f.verifier,
    );
    const body = (await response.json()) as { value?: string };
    return response.status === 200 && body.value === "synthetic-user";
  }
  const messages: Array<{ type: string; endVersion?: { identity: number } }> = [];
  const session = new SyncSession(f.engine, f.verifier, {
    send: (text) => messages.push(JSON.parse(text)),
    close: () => undefined,
  });
  session.receive(
    JSON.stringify({ type: "Authenticate", tokenType: "User", value: token, baseVersion: 0 }),
  );
  await eventually(
    () => messages,
    (seen) =>
      seen.some((message) => message.type === "AuthError" || message.endVersion?.identity === 1),
  );
  session.closed = true;
  return !messages.some((message) => message.type === "AuthError");
}

for (const kind of ["http", "sync"] as const) {
  describe(`${kind} auth consumer`, () => {
    it("honours a successful empty JWKS as revocation, not a refresh outage", async () => {
      const f = fixture();
      const good = await first.sign({ sub: "synthetic-user", exp: Math.floor(NOW / 1000) + 7200 });
      expect(await consume(f, good, kind)).toBe(true);
      f.revoke();
      f.advance(3_600_001);
      expect(await consume(f, good, kind)).toBe(false);
      expect(await consume(f, good, kind)).toBe(false);
      expect(f.calls).toHaveLength(4);
    });

    it("coalesces cold/rotated refreshes and bounds serial and concurrent unknown kids", async () => {
      const f = fixture();
      const good = await first.sign({ sub: "synthetic-user" });
      expect(await Promise.all(Array.from({ length: 10 }, () => consume(f, good, kind)))).toEqual(
        Array(10).fill(true),
      );
      expect(f.calls).toHaveLength(2);
      const unknown = await first.sign(
        { sub: "synthetic-user" },
        { header: { alg: "RS256", kid: "unknown" } },
      );
      for (let i = 0; i < 10; i++) expect(await consume(f, unknown, kind)).toBe(false);
      expect(
        await Promise.all(Array.from({ length: 20 }, () => consume(f, unknown, kind))),
      ).toEqual(Array(20).fill(false));
      expect(f.calls).toHaveLength(2);
      f.advance(30_001);
      expect(
        await Promise.all(Array.from({ length: 20 }, () => consume(f, unknown, kind))),
      ).toEqual(Array(20).fill(false));
      expect(f.calls).toHaveLength(4);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(4);
      f.advance(30_001);
      f.rotate();
      const newToken = await rotated.sign(
        { sub: "synthetic-user" },
        { header: { alg: "RS256", kid: "rotated" } },
      );
      expect(
        await Promise.all(Array.from({ length: 10 }, () => consume(f, newToken, kind))),
      ).toEqual(Array(10).fill(true));
      expect(f.calls).toHaveLength(6);
      expect(await consume(f, good, kind)).toBe(false);
    });

    it("coalesces failed cold refreshes, rejects tokens during cooldown and recovers", async () => {
      const f = fixture();
      const good = await first.sign({ sub: "synthetic-user" });
      f.unavailable(true);
      expect(await Promise.all(Array.from({ length: 20 }, () => consume(f, good, kind)))).toEqual(
        Array(20).fill(false),
      );
      expect(f.calls).toHaveLength(1);
      f.unavailable(false);
      expect(await consume(f, good, kind)).toBe(false);
      expect(f.calls).toHaveLength(1);
      f.advance(30_001);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(3);
    });

    it("does not retain no-store signing keys", async () => {
      const f = fixture();
      f.cache("no-store");
      const good = await first.sign({ sub: "synthetic-user" });
      expect(await consume(f, good, kind)).toBe(true);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(4);
      const unknown = await first.sign(
        { sub: "synthetic-user" },
        {
          header: { alg: "RS256", kid: "unknown-no-store" },
        },
      );
      for (let i = 0; i < 10; i++) expect(await consume(f, unknown, kind)).toBe(false);
      expect(
        await Promise.all(Array.from({ length: 20 }, () => consume(f, unknown, kind))),
      ).toEqual(Array(20).fill(false));
      expect(f.calls).toHaveLength(4);
      f.unavailable(true);
      expect(await consume(f, good, kind)).toBe(false);
      expect(f.calls).toHaveLength(5);
    });

    it("honours max-age/Age and retains known keys through a bounded refresh outage, then recovers", async () => {
      const f = fixture();
      f.cache("public, max-age=3600", "1800");
      const good = await first.sign({ sub: "synthetic-user" });
      expect(await consume(f, good, kind)).toBe(true);
      f.advance(1_799_000);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(2);
      f.advance(2_000);
      f.unavailable(true);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(3);
      expect(await Promise.all(Array.from({ length: 10 }, () => consume(f, good, kind)))).toEqual(
        Array(10).fill(true),
      );
      expect(f.calls).toHaveLength(3);
      f.advance(301_000);
      expect(await consume(f, good, kind)).toBe(false);
      f.unavailable(false);
      f.advance(30_001);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(6);
    });

    for (const boundary of ["discovery", "jwks"] as const) {
      it.each([
        { control: "public, max-age=60, stale-if-error=30", age: "89" },
        { control: "public, max-age=60", age: "359" },
      ])(
        `does not reset consumed ${boundary} grace ($control, Age $age)`,
        async ({ control, age }) => {
          const f = fixture();
          f.cache(control, age, boundary);
          const good = await first.sign({ sub: "synthetic-user" });
          expect(await consume(f, good, kind)).toBe(true);
          f.unavailable(true);
          f.advance(999);
          expect(await consume(f, good, kind)).toBe(true);
          expect(f.calls).toHaveLength(3);
          // The failure cooldown must not extend the last millisecond of grace.
          f.advance(1);
          expect(await consume(f, good, kind)).toBe(false);
          expect(f.calls).toHaveLength(3);
          f.unavailable(false);
          f.advance(30_001);
          expect(await consume(f, good, kind)).toBe(true);
          expect(f.calls).toHaveLength(5);
        },
      );

      it(`counts ${boundary} body time against the original deadline`, async () => {
        const f = fixture();
        f.cache("public, max-age=60, stale-if-error=30", "59", boundary);
        f.delayBody(boundary, 2_000);
        const good = await first.sign({ sub: "synthetic-user" });
        expect(await consume(f, good, kind)).toBe(true);
        f.unavailable(true);
        f.advance(28_999);
        expect(await consume(f, good, kind)).toBe(true);
        f.advance(1);
        expect(await consume(f, good, kind)).toBe(false);
      });
    }

    it("does not rebase discovery expiry after fetching the signing keys", async () => {
      const f = fixture();
      f.cache("public, max-age=60, stale-if-error=30", "59", "discovery");
      f.delayKeys(2_000);
      const good = await first.sign({ sub: "synthetic-user" });
      expect(await consume(f, good, kind)).toBe(true);
      f.unavailable(true);
      f.advance(28_999);
      expect(await consume(f, good, kind)).toBe(true);
      f.advance(1);
      expect(await consume(f, good, kind)).toBe(false);
    });

    it("never uses stale keys when Cache-Control forbids it", async () => {
      const f = fixture();
      f.cache("no-cache, must-revalidate");
      const good = await first.sign({ sub: "synthetic-user" });
      expect(await consume(f, good, kind)).toBe(true);
      expect(await consume(f, good, kind)).toBe(true);
      expect(f.calls).toHaveLength(4);
      f.unavailable(true);
      expect(await consume(f, good, kind)).toBe(false);
      expect(await consume(f, good, kind)).toBe(false);
      expect(f.calls).toHaveLength(5);
      f.unavailable(false);
      f.advance(30_001);
      expect(await consume(f, good, kind)).toBe(true);
    });

    it("rejects malformed refreshes without discarding the last good keys", async () => {
      const f = fixture();
      const good = await first.sign({ sub: "synthetic-user" });
      expect(await consume(f, good, kind)).toBe(true);
      f.advance(3_600_001);
      // Token still needs to be current after advancing the verifier clock.
      const current = await first.sign({
        sub: "synthetic-user",
        exp: Math.floor(NOW / 1000) + 7200,
      });
      first.jwks.keys.push(null as never);
      try {
        expect(await consume(f, current, kind)).toBe(true);
      } finally {
        first.jwks.keys.pop();
      }
    });
  });
}

describe("synthetic provider environment boundary", () => {
  it.each([undefined, "", "prod", "staging", "production"])(
    "ignores extras in unnamed or non-preview environments (%s)",
    (ENVIRONMENT) => {
      const base = authProviders({} as never);
      expect(
        authProviders({
          ENVIRONMENT,
          EXTRA_AUTH_PROVIDERS: JSON.stringify([first.provider]),
        } as never),
      ).toEqual(base);
    },
  );
  it.each(["preview", "development"])(
    "allows valid providers only in %s, rejecting malformed config without crashing",
    (ENVIRONMENT) => {
      const base = authProviders({} as never);
      expect(
        authProviders({
          ENVIRONMENT,
          EXTRA_AUTH_PROVIDERS: JSON.stringify([first.provider]),
        } as never),
      ).toEqual([...base, first.provider]);
      for (const value of ["{", "null", "{}", "[null]", '[{"domain":"https://example.test"}]']) {
        expect(authProviders({ ENVIRONMENT, EXTRA_AUTH_PROVIDERS: value } as never)).toEqual(base);
      }
    },
  );
});
