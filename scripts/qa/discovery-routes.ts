// Exercises the compiled workers-rs artifact, not native helpers or a second build.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { unstable_startWorker } from "wrangler";

const backend = process.env.CHRONDLE_DISCOVERY_BACKEND;
const directory = mkdtempSync(join(tmpdir(), "chrondle-discovery-"));
let mode: "refuse" | "live" = "refuse";
let queries = 0;
const observedCounts: Record<string, number> = {};
const outboundFailures: string[] = [];
const logs: string[] = [];
const results: { name: string; status: number; urls?: number }[] = [];
let worker: Awaited<ReturnType<typeof unstable_startWorker>> | undefined;
try {
  const config = join(directory, "wrangler.json");
  writeFileSync(
    config,
    JSON.stringify({
      name: "chrondle-discovery-check",
      main: resolve("web/build/worker/shim.mjs"),
      compatibility_date: "2026-09-17",
      send_metrics: false,
      vars: { NEXT_PUBLIC_CONVEX_URL: backend ?? "https://unavailable.invalid" },
    }),
  );
  worker = await unstable_startWorker({
    config,
    dev: {
      remote: false,
      persist: false,
      watch: false,
      server: { hostname: "127.0.0.1", port: 0 },
      logLevel: "error",
      structuredLogsHandler: (log: { message: string }) => logs.push(log.message),
      outboundService: async (request: Request) => {
        try {
          queries++;
          assert.equal(request.headers.get("cookie"), null);
          assert.equal(request.headers.get("authorization"), null);
          const url = new URL(request.url);
          assert.equal(url.pathname, "/api/query");
          assert.equal(url.search, "");
          assert.equal(request.method, "POST");
          const body = await request.clone().json();
          assert.equal(body.format, "convex_encoded_json");
          assert.equal(body.args.length, 1);
          assert(
            ["puzzles:getTotalPuzzles", "orderPuzzles:getArchiveOrderPuzzles"].includes(body.path),
          );
          if (mode === "refuse") return new Response("Controlled network refusal", { status: 503 });
          assert(backend, "Live reads require an explicit public backend");
          assert.equal(url.origin, new URL(backend).origin);
          const response = await fetch(request.url, {
            method: request.method,
            headers: Object.fromEntries(request.headers),
            body: await request.text(),
            signal: AbortSignal.timeout(30_000),
          });
          const payload = await response.clone().json();
          assert.equal(payload.status, "success");
          const count =
            body.path === "puzzles:getTotalPuzzles"
              ? payload.value.count
              : payload.value.totalCount;
          assert(Number.isSafeInteger(count) && count >= 0);
          observedCounts[body.path] = count;
          return response;
        } catch (error) {
          outboundFailures.push(error instanceof Error ? error.message : String(error));
          return new Response("Discovery verifier failure", { status: 503 });
        }
      },
    },
  });
  const origin = await worker.url;
  const request = (path: string, method = "GET") =>
    worker!.fetch(new URL(path, origin), {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
      headers: { cookie: "privacy-canary=value", authorization: "Bearer privacy-canary" },
    });
  const rust = (response: Response, status: number) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("x-chrondle-runtime"), "rust");
    assert(response.headers.get("x-chrondle-revision"));
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  };
  for (const [path, location] of [
    ["/groups?x=%2F&x=2", "/?x=%2F&x=2"],
    ["/archive/groups", "/archive"],
    ["/archive/groups/42?x=1", "/archive?x=1"],
    ["/releases?from=old", "/changelog"],
  ]) {
    const response = await request(path);
    rust(response, 308);
    assert.equal(response.headers.get("location"), location);
    results.push({ name: path, status: response.status });
  }
  for (const path of [
    "/classic",
    "/api/stripe/checkout",
    "/releases/1.13.1",
    "/archive/groups-other",
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404);
    assert.equal(
      response.headers.get("x-chrondle-runtime"),
      null,
      "Retained route must fall through untouched",
    );
    results.push({ name: `fallthrough ${path}`, status: response.status });
  }
  const robots = await request("/robots.txt");
  rust(robots, 200);
  assert.equal(await robots.text(), readFileSync("web/robots.txt", "utf8"));
  const head = await request("/robots.txt", "HEAD");
  rust(head, 200);
  assert.equal(await head.text(), "");
  assert.equal(queries, 0, "Static and unknown routes must not access any backend");
  const rejected = await request("/sitemap.xml", "POST");
  rust(rejected, 405);
  assert.equal(rejected.headers.get("allow"), "GET, HEAD");
  assert.equal(queries, 0, "Rejected method must not access the backend");
  results.push({ name: "robots GET/HEAD and sitemap POST rejection", status: 200 });

  const checkSitemap = async (name: string, expected: () => number) => {
    const response = await request("/sitemap.xml?privacy-canary=query");
    rust(response, 200);
    assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
    const body = await response.text();
    assert(!body.includes("privacy-canary") && !body.includes("targetYear"));
    const locations = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.equal(locations.length, expected());
    assert.equal(new Set(locations).size, locations.length);
    assert.equal(locations[0], "https://chrondle.app");
    assert.equal(locations[6], "https://chrondle.app/legal/terms");
    assert.equal([...body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].length, 5);
    results.push({ name, status: response.status, urls: locations.length });
  };
  await checkSitemap("backend refusal: static routes survive", () => 7);
  if (backend) {
    const expected = () => {
      assert.equal(
        Object.keys(observedCounts).length,
        2,
        `Both real queries must succeed: ${outboundFailures.join("; ")}`,
      );
      return 7 + Object.values(observedCounts).reduce((sum, count) => sum + count, 0);
    };
    mode = "live";
    await checkSitemap("real anonymous backend", expected);
    mode = "refuse";
    await checkSitemap("backend outage after success", () => 7);
    mode = "live";
    await checkSitemap("real backend recovery without restart", expected);
  }
  assert.deepEqual(outboundFailures, []);
  assert(!logs.some((line) => line.includes("privacy-canary")));
  console.log(
    JSON.stringify(
      { results, realBackendRead: Boolean(backend), observedCounts, queries },
      null,
      2,
    ),
  );
} finally {
  await worker?.dispose();
  rmSync(directory, { recursive: true, force: true });
}
