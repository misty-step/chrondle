#!/usr/bin/env node

import { resolveCname as resolveCnameCallback } from "node:dns";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const DEFAULT_APP_ORIGIN = "https://chrondle.app";
const DEFAULT_CLERK_HOST = "clerk.chrondle.app";
const EXPECTED_CLERK_CNAME = "frontend-api.clerk.services";
const DEFAULT_CONVEX_URL = "https://fleet-goldfish-183.convex.cloud";

const systemResolveCname = promisify(resolveCnameCallback);

function normalizedHost(value) {
  return value.toLowerCase().replace(/\.$/, "");
}

async function capture(name, check) {
  try {
    return { name, ...(await check()) };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchStatus(fetchImpl, url, init) {
  const response = await fetchImpl(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    ...init,
  });
  return response;
}

async function defaultQueryConvexCorpus() {
  const [{ ConvexHttpClient }, { api }] = await Promise.all([
    import("convex/browser"),
    import("../convex/_generated/api.js"),
  ]);
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || DEFAULT_CONVEX_URL);
  const [totalResult, archive] = await Promise.all([
    client.query(api.puzzles.getTotalPuzzles, {}),
    client.query(api.puzzles.getArchivePuzzles, { page: 1, pageSize: 1 }),
  ]);
  return {
    totalPuzzles: totalResult.count,
    latestPuzzleDate: archive.puzzles[0]?.date ?? null,
  };
}

export async function verifyHostingParity({
  appOrigin = DEFAULT_APP_ORIGIN,
  clerkHost = DEFAULT_CLERK_HOST,
  fetchImpl = fetch,
  resolveCname = systemResolveCname,
  queryConvexCorpus = defaultQueryConvexCorpus,
} = {}) {
  const checks = [];

  checks.push(
    await capture("clerk-cname", async () => {
      const records = (await resolveCname(clerkHost)).map(normalizedHost);
      const ok = records.includes(EXPECTED_CLERK_CNAME);
      return {
        ok,
        detail: ok
          ? `resolved to ${EXPECTED_CLERK_CNAME}`
          : `expected ${EXPECTED_CLERK_CNAME}; got ${records.length ? records.join(", ") : "no CNAME"}`,
      };
    }),
  );

  checks.push(
    await capture("clerk-client", async () => {
      const response = await fetchStatus(fetchImpl, `https://${clerkHost}/v1/client`);
      return { ok: response.status === 200, detail: `HTTP ${response.status}` };
    }),
  );

  checks.push(
    await capture("convex-corpus", async () => {
      const { totalPuzzles, latestPuzzleDate } = await queryConvexCorpus();
      const ok = Number.isInteger(totalPuzzles) && totalPuzzles > 0 && Boolean(latestPuzzleDate);
      return {
        ok,
        detail: `total-puzzles=${totalPuzzles}; latest-date=${latestPuzzleDate ?? "missing"}`,
      };
    }),
  );

  checks.push(
    await capture("app-health", async () => {
      const response = await fetchStatus(fetchImpl, `${appOrigin}/api/health`);
      const body = await response.json();
      const ok =
        response.status === 200 &&
        body.status === "ok" &&
        body.checks?.convex === "ok" &&
        body.checks?.canary === "configured";
      return {
        ok,
        detail: `HTTP ${response.status}; convex=${body.checks?.convex ?? "missing"}; canary=${body.checks?.canary ?? "missing"}`,
      };
    }),
  );

  checks.push(
    await capture("sign-in-route", async () => {
      const response = await fetchStatus(fetchImpl, `${appOrigin}/sign-in`);
      const body = await response.text();
      const referencesClerkDomain = body.includes(clerkHost);
      return {
        ok: response.status === 200 && referencesClerkDomain,
        detail: `HTTP ${response.status}; custom-domain-reference=${referencesClerkDomain}`,
      };
    }),
  );

  for (const [name, path] of [
    ["stripe-checkout-auth-boundary", "/api/stripe/checkout"],
    ["stripe-portal-auth-boundary", "/api/stripe/portal"],
  ]) {
    checks.push(
      await capture(name, async () => {
        const response = await fetchStatus(fetchImpl, `${appOrigin}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        return {
          ok: response.status === 401,
          detail: `HTTP ${response.status}; expected signed-out rejection before provider action`,
        };
      }),
    );
  }

  const observedAt = new Date();
  return {
    ok: checks.every(({ ok }) => ok),
    appOrigin,
    clerkHost,
    observedAtUtc: observedAt.toISOString(),
    observedAtLocal: observedAt.toLocaleString("en-US", { timeZoneName: "short" }),
    checks,
  };
}

function printHuman(report) {
  console.log(
    `Chrondle hosting parity doctor (${report.observedAtUtc} / ${report.observedAtLocal})`,
  );
  for (const check of report.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`);
  }
  console.log(report.ok ? "PASS hosting parity" : "FAIL hosting parity");
}

async function main() {
  const report = await verifyHostingParity();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
