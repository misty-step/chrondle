import assert from "node:assert/strict";
import { test } from "vitest";

import { verifyHostingParity } from "./verify-hosting-parity.mjs";

const healthyFetch = async (url, init = {}) => {
  const path = new URL(url).pathname;

  if (path === "/v1/client") {
    return new Response(JSON.stringify({ response: { client: {} } }), { status: 200 });
  }
  if (path === "/api/health") {
    return new Response(JSON.stringify({ status: "ok", checks: { convex: "ok" } }), {
      status: 200,
    });
  }
  if (path === "/sign-in") {
    return new Response("<html>clerk.chrondle.app</html>", { status: 200 });
  }
  if (path === "/api/stripe/checkout" || path === "/api/stripe/portal") {
    assert.equal(init.method, "POST");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  throw new Error(`unexpected request: ${url}`);
};

const healthyConvexCorpus = async () => ({ totalPuzzles: 365, latestPuzzleDate: "2026-07-09" });

// Clerk's production domain dns_targets (Clerk Backend API GET /v1/domains).
const clerkDnsTargets = {
  "clerk.chrondle.app": "frontend-api.clerk.services",
  "accounts.chrondle.app": "accounts.clerk.services",
  "clkmail.chrondle.app": "mail.h8zn0um1i4rl.clerk.services",
  "clk._domainkey.chrondle.app": "dkim1.h8zn0um1i4rl.clerk.services",
  "clk2._domainkey.chrondle.app": "dkim2.h8zn0um1i4rl.clerk.services",
};

const healthyResolveCname = async (host) => {
  const target = clerkDnsTargets[host];
  if (!target) {
    throw Object.assign(new Error(`queryCname ENOTFOUND ${host}`), { code: "ENOTFOUND" });
  }
  return [`${target}.`];
};

const resolveCnameWithout = (missingHost) => async (host) => {
  if (host === missingHost) {
    throw Object.assign(new Error(`queryCname ENOTFOUND ${host}`), { code: "ENOTFOUND" });
  }
  return healthyResolveCname(host);
};

const clerkCnameChecks = (ok) =>
  Object.keys(clerkDnsTargets).map((host) => [`clerk-cname:${host}`, ok]);

test("passes the public auth, Convex, and charge-free Stripe boundary", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    fetchImpl: healthyFetch,
    resolveCname: healthyResolveCname,
    queryConvexCorpus: healthyConvexCorpus,
  });

  assert.equal(report.ok, true);
  assert.deepEqual(
    report.checks.map(({ name, ok }) => [name, ok]),
    [
      ...clerkCnameChecks(true),
      ["clerk-client", true],
      ["convex-corpus", true],
      ["app-health", true],
      ["sign-in-route", true],
      ["stripe-checkout-auth-boundary", true],
      ["stripe-portal-auth-boundary", true],
    ],
  );
});

test("fails when the Clerk custom-domain CNAME disappears", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    fetchImpl: healthyFetch,
    resolveCname: async (host) => (host === "clerk.chrondle.app" ? [] : healthyResolveCname(host)),
    queryConvexCorpus: healthyConvexCorpus,
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.checks[0], {
    name: "clerk-cname:clerk.chrondle.app",
    ok: false,
    detail: "clerk.chrondle.app: expected CNAME frontend-api.clerk.services; got no CNAME",
  });
});

test("fails naming the host when the Clerk mail CNAME is NXDOMAIN", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    fetchImpl: healthyFetch,
    resolveCname: resolveCnameWithout("clkmail.chrondle.app"),
    queryConvexCorpus: healthyConvexCorpus,
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.filter(({ ok }) => !ok),
    [
      {
        name: "clerk-cname:clkmail.chrondle.app",
        ok: false,
        detail:
          "clkmail.chrondle.app: expected CNAME mail.h8zn0um1i4rl.clerk.services; got no CNAME (ENOTFOUND)",
      },
    ],
  );
});

test("fails when a Clerk DKIM CNAME points at the wrong target", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    fetchImpl: healthyFetch,
    resolveCname: async (host) =>
      host === "clk2._domainkey.chrondle.app"
        ? ["dkim1.h8zn0um1i4rl.clerk.services"]
        : healthyResolveCname(host),
    queryConvexCorpus: healthyConvexCorpus,
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.find(({ name }) => name === "clerk-cname:clk2._domainkey.chrondle.app"),
    {
      name: "clerk-cname:clk2._domainkey.chrondle.app",
      ok: false,
      detail:
        "clk2._domainkey.chrondle.app: expected CNAME dkim2.h8zn0um1i4rl.clerk.services; got dkim1.h8zn0um1i4rl.clerk.services",
    },
  );
});

test("fails if a Stripe endpoint reaches provider logic while signed out", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    resolveCname: healthyResolveCname,
    queryConvexCorpus: healthyConvexCorpus,
    fetchImpl: async (url, init) => {
      if (new URL(url).pathname === "/api/stripe/checkout") {
        return new Response(JSON.stringify({ url: "https://checkout.stripe.com/session" }), {
          status: 200,
        });
      }
      return healthyFetch(url, init);
    },
  });

  assert.equal(report.ok, false);
  assert.equal(
    report.checks.find(({ name }) => name === "stripe-checkout-auth-boundary").ok,
    false,
  );
});

test("fails if the Convex production corpus is empty", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    resolveCname: healthyResolveCname,
    fetchImpl: healthyFetch,
    queryConvexCorpus: async () => ({ totalPuzzles: 0, latestPuzzleDate: null }),
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.find(({ name }) => name === "convex-corpus").ok, false);
});
