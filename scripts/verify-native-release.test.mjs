// @vitest-environment node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, test } from "vitest";
import { readback } from "./verify-native-release.mjs";

const revision = "a".repeat(40);
const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

test("production readback rejects activation without completed smoke and exact run identity", async () => {
  let health = { status: "ok", revision, checks: { convex: "ok" } };
  let receipt = { status: "healthy", revision, run_id: 123, run_attempt: 2, run_url: "https://github.com/misty-step/chrondle/actions/runs/123" };
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url === "/api/health" ? health : receipt));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const expected = { revision, run_id: 123, run_attempt: 2 };
  assert.equal((await readback(base, expected)).revision, revision);

  receipt = { ...receipt, status: "checking" };
  await assert.rejects(readback(base, expected), /smoke has not completed/);
  receipt = { ...receipt, status: "healthy", run_attempt: 1 };
  await assert.rejects(readback(base, expected), /run_attempt/);
  receipt = { ...receipt, run_attempt: 2, revision: "b".repeat(40) };
  await assert.rejects(readback(base, expected), /smoke has not completed/);
  receipt = { ...receipt, revision };
  health = { ...health, status: "error" };
  await assert.rejects(readback(base, expected), /health or revision/);
});
