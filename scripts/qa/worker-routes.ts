// Ported from Linejam PR577 (449f9eb6): exercise the built bytes, never rebuild.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { unstable_readConfig, unstable_startWorker } from "wrangler";
import { parseChangelog } from "../../src/lib/releases/changelog";
import { assertHtml, assertRuntimeLogs } from "./worker-route-contracts";

async function main() {
  const config = unstable_readConfig({ config: "wrangler.jsonc", env: "production" });
  assert(config.main && config.assets?.directory, "Build the configured OpenNext artifact first");
  const releases = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
  const directory = mkdtempSync(join(tmpdir(), "chrondle-worker-routes-"));
  const logs: { level: string; message: string }[] = [];
  const failures: string[] = [];
  let blockedRequests = 0;
  let worker: Awaited<ReturnType<typeof unstable_startWorker>> | undefined;
  try {
    // Fresh config location: never load repo .dev.vars, dotenv, bindings or credentials.
    const configPath = join(directory, "wrangler.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        name: "chrondle-worker-routes",
        main: resolve(config.main),
        compatibility_date: config.compatibility_date,
        compatibility_flags: config.compatibility_flags,
        assets: { ...config.assets, directory: resolve(config.assets.directory) },
        send_metrics: false,
      }),
    );
    worker = await unstable_startWorker({
      config: configPath,
      // Clerk requires a syntactically present key even for anonymous public SSR.
      // This inert local-only fixture is not a credential; every outbound fetch is denied.
      bindings: {
        CLERK_SECRET_KEY: { type: "plain_text", value: "sk_test_worker-route-gate" },
        STRIPE_SYNC_SECRET: { type: "plain_text", value: "inert-local-webhook-check" },
      },
      dev: {
        remote: false,
        persist: false,
        watch: false,
        server: { hostname: "127.0.0.1", port: 0 },
        logLevel: "error",
        outboundService: () => {
          blockedRequests++;
          return new Response("Worker route check: egress disabled", { status: 503 });
        },
        structuredLogsHandler: (log: { level: string; message: string }) => logs.push(log),
      },
    });
    worker.raw.on("runtimeError", (error: { text: string }) => {
      logs.push({ level: "error", message: error.text });
    });
    // Next normalizes loopback hostnames to localhost; use that host on ingress
    // so its middleware does not mistake normalization for an external rewrite.
    const origin = new URL(await worker.url);
    origin.hostname = "localhost";
    const probes = [
      { path: "/legal/privacy", status: 200, markers: ["Privacy"] },
      {
        path: "/changelog",
        status: 200,
        markers: ["Changelog", `Release ${releases[0].version}`, releases[0].date, "<li"],
      },
      ...releases.map((release) => ({
        path: `/releases/${release.version}`,
        status: 200,
        markers: [
          `v${release.version}</h1>`,
          release.date,
          `https://github.com/misty-step/chrondle/releases/tag/v${release.version}`,
        ],
      })),
      { path: "/releases/9999.0.0", status: 404, markers: [] },
      { path: "/releases", status: 200, markers: ["Changelog", `Release ${releases[0].version}`] },
    ];
    for (const probe of probes) {
      try {
        let response = await worker.fetch(new URL(probe.path, origin), {
          redirect: "manual",
          signal: AbortSignal.timeout(15_000),
        });
        if (probe.path === "/releases") {
          assert.equal(response.status, 308, "Legacy index must permanently redirect");
          const target = new URL(response.headers.get("location") ?? "", origin);
          assert.equal(target.origin, origin.origin);
          assert.equal(target.pathname, "/changelog");
          response = await worker.fetch(target, {
            redirect: "manual",
            signal: AbortSignal.timeout(15_000),
          });
        }
        assertHtml(probe.path, response, await response.text(), probe.status, probe.markers);
        console.log(`PASS ${probe.path}: ${response.status}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${probe.path}: ${message}`);
        console.error(`FAIL ${failures.at(-1)}`);
      }
    }
    const robots = await worker.fetch(new URL("/robots.txt", origin));
    assert.equal(robots.status, 200);
    assert.equal(robots.headers.get("x-chrondle-runtime"), "rust");
    assert.equal(await robots.text(), readFileSync("web/robots.txt", "utf8"));
    const sitemap = await worker.fetch(new URL("/sitemap.xml", origin));
    assert.equal(sitemap.status, 200);
    assert.equal(sitemap.headers.get("x-chrondle-runtime"), "rust");
    assert.equal((await sitemap.text()).match(/<url>/g)?.length, 7);
    for (const [path, location] of [
      ["/groups?x=1", "/?x=1"],
      ["/archive/groups/42?x=1", "/archive?x=1"],
    ]) {
      const response = await worker.fetch(new URL(path, origin), { redirect: "manual" });
      assert.equal(response.status, 308);
      assert.equal(response.headers.get("location"), location);
      assert.equal(response.headers.get("x-chrondle-runtime"), "rust");
    }
    const beforePost = blockedRequests;
    const checkout = await worker.fetch(new URL("/api/stripe/checkout", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"plan":"monthly"}',
    });
    assert.equal(checkout.status, 401, "Retained checkout must still require identity");
    const webhook = await worker.fetch(new URL("/api/webhooks/stripe", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"probe":"raw-body"}',
    });
    assert.equal(
      webhook.status,
      400,
      "Retained webhook must read the body and reject missing signature",
    );
    assert.equal((await webhook.json()).error, "Missing signature");
    assert.equal(blockedRequests, beforePost, "Rejected billing requests must not reach providers");
    console.log("PASS Rust discovery/redirect integration and unchanged billing POST rejection");
    const blockedBefore = blockedRequests;
    const health = await worker.fetch(new URL("/api/health", origin), {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(health.status, 503, "Isolated backend must be unreachable");
    const body = await health.json();
    assert.equal(body.error, "Convex connectivity failed");
    assert.equal(body.checks.convex, "unhealthy");
    assert.equal(body.version, releases[0].version);
    assert(blockedRequests > blockedBefore, "Backend egress denial must be exercised");
    console.log(`PASS /api/health: 503, version ${body.version}, backend request denied`);
  } finally {
    await worker?.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
  assertRuntimeLogs(logs);
  assert.equal(failures.length, 0, `Built Worker route failures:\n${failures.join("\n")}`);
  console.log(
    `Built Worker routes passed: ${releases.length} release details, changelog, alias, unknown 404 and privacy control; ${blockedRequests} outbound requests denied.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
