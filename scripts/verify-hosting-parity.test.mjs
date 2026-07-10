import assert from "node:assert/strict";
import test from "node:test";

import { verifyHostingParity } from "./verify-hosting-parity.mjs";

const healthyFetch = async (url, init = {}) => {
  const path = new URL(url).pathname;

  if (path === "/v1/client") {
    return new Response(JSON.stringify({ response: { client: {} } }), { status: 200 });
  }
  if (path === "/api/health") {
    return new Response(
      JSON.stringify({ status: "ok", checks: { convex: "ok", canary: "configured" } }),
      { status: 200 },
    );
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

test("passes the public auth, Convex, Canary, and charge-free Stripe boundary", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    fetchImpl: healthyFetch,
    resolveCname: async () => ["frontend-api.clerk.services"],
    queryConvexCorpus: healthyConvexCorpus,
  });

  assert.equal(report.ok, true);
  assert.deepEqual(
    report.checks.map(({ name, ok }) => [name, ok]),
    [
      ["clerk-cname", true],
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
    resolveCname: async () => [],
    queryConvexCorpus: healthyConvexCorpus,
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.checks[0], {
    name: "clerk-cname",
    ok: false,
    detail: "expected frontend-api.clerk.services; got no CNAME",
  });
});

test("fails if a Stripe endpoint reaches provider logic while signed out", async () => {
  const report = await verifyHostingParity({
    appOrigin: "https://chrondle.app",
    clerkHost: "clerk.chrondle.app",
    resolveCname: async () => ["frontend-api.clerk.services"],
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
    resolveCname: async () => ["frontend-api.clerk.services"],
    fetchImpl: healthyFetch,
    queryConvexCorpus: async () => ({ totalPuzzles: 0, latestPuzzleDate: null }),
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.find(({ name }) => name === "convex-corpus").ok, false);
});
