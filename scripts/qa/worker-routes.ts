// Ported from Linejam PR577 (449f9eb6): exercise the built bytes, never rebuild.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { unstable_readConfig, unstable_startWorker } from "wrangler";
import { parseChangelog } from "../../src/lib/releases/changelog";
import { assertHtml, assertRuntimeLogs } from "./worker-route-contracts";

function assertPackagedModuleRejection(artifact: string) {
  const directory = mkdtempSync(join(tmpdir(), "chrondle-module-canary-"));
  try {
    const copy = join(directory, "artifact");
    cpSync(artifact, copy, { recursive: true });
    // Give a mistaken rebundle the checkout dependencies that hid this defect.
    symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "dir");
    const config = JSON.parse(readFileSync(join(copy, "wrangler.json"), "utf8"));
    appendFileSync(
      resolve(copy, config.main),
      '\nimport ReactCanary from "react"; globalThis.__chrondleModuleCanary = ReactCanary.version;\n',
    );
    // Separate processes also contain Wrangler's unhandled startup rejection.
    const results = ["worker-routes", "discovery-routes"].map((suite) => {
      const child = spawnSync(
        process.execPath,
        ["--unhandled-rejections=strict", "--import", "tsx", resolve(`scripts/qa/${suite}.ts`)],
        {
          env: { ...process.env, CHRONDLE_ARTIFACT: copy, CHRONDLE_MODULE_CANARY: "1" },
          encoding: "utf8",
          timeout: 60_000,
        },
      );
      console.log(`Module canary ${suite}: exit ${child.status}`);
      if (child.error || child.signal) console.error(child.stdout, child.stderr);
      return { suite, child };
    });
    for (const { suite, child } of results) {
      assert.ifError(child.error);
      assert.equal(child.signal, null, `${suite}: canary must fail, not time out`);
      assert.notEqual(child.status, 0, `${suite}: unresolved packaged import was repaired by bundling`);
      assert.match(
        `${child.stdout}\n${child.stderr}`.replaceAll('\\"', '"'),
        /No such module ["']react["']/,
        `${suite}: must reject the unresolved packaged import`,
      );
    }
    console.log("PASS both packaged suites reject an unresolved import without rebundling");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function main() {
  const configRoot = process.env.CHRONDLE_ARTIFACT ?? ".";
  const config = unstable_readConfig(process.env.CHRONDLE_ARTIFACT
    ? { config: resolve(process.env.CHRONDLE_ARTIFACT, "wrangler.json") }
    : { config: "wrangler.jsonc", env: "production" });
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
        no_bundle: config.no_bundle,
        find_additional_modules: config.find_additional_modules,
        rules: config.rules,
        assets: { ...config.assets, directory: resolve(configRoot, config.assets.directory) },
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
        structuredLogsHandler: (log: { level: string; message: string }) => {
          assertRuntimeLogs([log]);
          logs.push(log);
        },
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
    if (process.env.CHRONDLE_REVISION) {
      assert.equal(robots.headers.get("x-chrondle-revision"), process.env.CHRONDLE_REVISION);
    }
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
    if (process.env.CHRONDLE_REVISION) assert.equal(body.revision, process.env.CHRONDLE_REVISION);
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
  if (process.env.CHRONDLE_ARTIFACT && !process.env.CHRONDLE_MODULE_CANARY) {
    assertPackagedModuleRejection(process.env.CHRONDLE_ARTIFACT);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
