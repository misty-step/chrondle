// @vitest-environment node
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { afterEach, test } from "vitest";
import { parse } from "yaml";
import { verifyWorkerReadiness } from "./verify-worker-readiness.mjs";

const revision = "a".repeat(40);
const healthy = { status: "ok", revision, checks: { convex: "ok" } };
const servers = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});
async function serve(handler) {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

test("deployment readiness tolerates a healthy old edge until the exact revision arrives", async () => {
  const urls = [];
  const origin = await serve((request, response) => {
    urls.push(request.url);
    assert.equal(request.headers["cache-control"], "no-cache");
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({ ...healthy, revision: urls.length < 3 ? "b".repeat(40) : revision }),
    );
  });
  const result = await verifyWorkerReadiness({ origin, revision, timeoutMs: 500, intervalMs: 5 });
  assert.equal(result.revision, revision);
  assert.equal(urls.length, 3);
  assert.equal(new Set(urls).size, 3);
  assert.ok(urls.every((url) => new URL(url, origin).searchParams.has("readiness")));
});

test("persistent wrong revision exhausts the bounded propagation window", async () => {
  let requests = 0;
  const origin = await serve((_request, response) => {
    requests++;
    response.end(JSON.stringify({ ...healthy, revision: "b".repeat(40) }));
  });
  const start = performance.now();
  // The last in-flight fetch can itself hit the overall deadline under load.
  await assert.rejects(
    verifyWorkerReadiness({ origin, revision, timeoutMs: 250, intervalMs: 20 }),
    /Wrong Worker revision|timeout/i,
  );
  assert.ok(requests >= 1);
  assert.ok(performance.now() - start < 2000);
});

for (const [name, status, body] of [
  ["HTTP failure even with the expected revision", 503, healthy],
  [
    "unhealthy backend even with the expected revision",
    200,
    { ...healthy, checks: { convex: "error" } },
  ],
  ["application error even with the expected revision", 200, { ...healthy, status: "error" }],
  ["missing revision", 200, { status: "ok", checks: { convex: "ok" } }],
  ["malformed JSON", 200, "not JSON"],
]) {
  test(`readiness immediately rejects ${name}, not a propagation retry`, async () => {
    let requests = 0;
    const origin = await serve((_request, response) => {
      requests++;
      response.writeHead(status);
      response.end(typeof body === "string" ? body : JSON.stringify(body));
    });
    await assert.rejects(
      verifyWorkerReadiness({ origin, revision, timeoutMs: 500, intervalMs: 5 }),
    );
    assert.equal(requests, 1);
  });
}

test("readiness rejects a redirect rather than verifying another origin", async () => {
  const origin = await serve((_request, response) => {
    response.writeHead(302, { Location: "/another-origin" });
    response.end();
  });
  await assert.rejects(verifyWorkerReadiness({ origin, revision }));
});

test("a stalled health request cannot exceed the overall deadline", async () => {
  const origin = await serve(() => {});
  const start = performance.now();
  await assert.rejects(
    verifyWorkerReadiness({ origin, revision, timeoutMs: 50 }),
    /timeout|aborted/i,
  );
  assert.ok(performance.now() - start < 1000);
});

test("production uses the same bounded verifier on all hosts and retains native rollback", () => {
  const workflow = parse(
    readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8"),
  );
  const steps = workflow.jobs.cloudflare.steps;
  assert.equal(
    steps.find(({ name }) => name === "Verify direct Worker readiness").run.trim(),
    "bun scripts/verify-worker-readiness.mjs https://chrondle.mistystep.io",
  );
  assert.match(
    steps.find(({ name }) => name === "Verify public release after DNS cutover").run,
    /bun scripts\/verify-worker-readiness\.mjs https:\/\/chrondle\.app https:\/\/www\.chrondle\.app/,
  );
  const rollback = steps.find(
    ({ name }) => name === "Roll back Worker on failed activation or smoke",
  );
  assert.equal(
    rollback.if,
    "failure() && steps.activate.outcome != 'skipped' && steps.previous.outcome == 'success'",
  );
  assert.match(rollback.run, /wrangler rollback/);
});
