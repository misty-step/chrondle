#!/usr/bin/env node
// Fault injection against a LOCAL workerd and its LOCAL R2 bucket, synthetic data only.
// First run verify-backend.mjs --full. Then:
// BACKEND_ADMIN_TOKEN=... node backend/scripts/verify-maintenance.mjs <url> <persist-to> <output-dir>
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [url, stateDir, outputDir] = process.argv.slice(2);
if (!url || !stateDir || !outputDir || !process.env.BACKEND_ADMIN_TOKEN)
  throw new Error("Usage: verify-maintenance.mjs <local-url> <persist-to> <output-dir>; requires BACKEND_ADMIN_TOKEN");
const host = new URL(url);
if (host.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(host.hostname))
  throw new Error("This destructive synthetic probe is local-only");
mkdirSync(outputDir, { recursive: true, mode: 0o700 });
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const results = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function request(method, path, body, headers = {}) {
  return fetch(`${url}/_backend/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.BACKEND_ADMIN_TOKEN}`, ...headers },
    body,
  });
}
async function admin(method, path, body) {
  const response = await request(method, path, body === undefined ? undefined : JSON.stringify(body));
  const result = await response.json();
  assert(response.ok, `${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
async function exported() {
  const response = await request("GET", "/export");
  assert(response.ok, `export: ${response.status}`);
  const body = await response.text();
  assert(response.headers.get("X-Backend-Sha256") === sha256(body), "export checksum is wrong");
  return body;
}
async function unchanged(before, body) {
  assert(JSON.stringify(await admin("GET", "/manifest")) === JSON.stringify(before), "manifest or timestamp changed after rejection");
  assert(await exported() === body, "snapshot changed after rejection");
}
function put(key, body) {
  const file = resolve(outputDir, "synthetic-r2-input");
  writeFileSync(file, body);
  execFileSync(process.execPath, [
    resolve("node_modules/wrangler/bin/wrangler.js"), "r2", "object", "put",
    `chrondle-backend-preview-backups/${key}`, "--local", "--persist-to", resolve(stateDir),
    "-c", "wrangler.jsonc", "--env", "preview", "--file", file,
  ], { cwd: resolve("backend"), stdio: "pipe" });
}
async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true, detail });
    console.log("PASS", name, JSON.stringify(detail));
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error("FAIL", name, error.message);
  }
}

await admin("POST", "/pause", { settleMs: 1000 });
const before = await admin("GET", "/manifest");
const body = await exported();
const records = () => body.trim().split("\n").map((line) => JSON.parse(line));
for (const part of ["documents", "registry", "jobs", "cursors", "replay"]) {
  await check(`R2 ${part} checksum rejection leaves all state unchanged`, async () => {
    const changed = records();
    if (part === "documents") changed.find((r) => r.table === "events" && r.document).document.event = "Synthetic corruption";
    else if (part === "registry") changed.push({ table: "safetyProbeEmpty", tableNumber: 99999 });
    else if (part === "jobs") changed.find((r) => r.scheduledFunction).scheduledFunction.scheduledTime = 1;
    else if (part === "cursors") changed.find((r) => r.cron).lastOccurrence = 1;
    else changed.find((r) => r.mutation).mutation.result = "null";
    const key = `backups/synthetic-corrupt-${part}.ndjson`;
    put(key, changed.map((r) => JSON.stringify(r)).join("\n") + "\n");
    put(`${key}.manifest.json`, JSON.stringify(before));
    const response = await request("POST", "/restore", JSON.stringify({ key }));
    const rejected = await response.json();
    assert(response.status === 400 && rejected.verified === false && rejected.mismatches.length > 0, JSON.stringify(rejected));
    await unchanged(before, body);
    return { status: response.status, mismatches: rejected.mismatches, stateUnchanged: true };
  });
}
await check("R2 missing runtime checksums fails closed", async () => {
  const key = "backups/synthetic-missing-runtime.ndjson";
  put(key, body);
  put(`${key}.manifest.json`, JSON.stringify({ manifest: before.manifest }));
  const response = await request("POST", "/restore", JSON.stringify({ key }));
  assert(response.status === 400, `status ${response.status}`);
  await unchanged(before, body);
  return { status: response.status, stateUnchanged: true };
});
for (const hash of [undefined, "0".repeat(64), "NOT-A-CHECKSUM"]) {
  await check(`import rejects ${hash === undefined ? "missing" : hash === "0".repeat(64) ? "wrong" : "malformed"} checksum`, async () => {
    const response = await request("POST", "/import", body, hash === undefined ? {} : { "X-Backend-Sha256": hash });
    assert(response.status === 400, `status ${response.status}`);
    await unchanged(before, body);
    return { status: response.status, stateUnchanged: true };
  });
}
await check("import schema rejection is atomic even with a correct transport checksum", async () => {
  const changed = records();
  changed.find((r) => r.table === "events" && r.document).document.event = 42;
  const invalid = changed.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const response = await request("POST", "/import", invalid, { "X-Backend-Sha256": sha256(invalid) });
  assert(response.status === 400, `status ${response.status}`);
  await unchanged(before, body);
  return { status: response.status, stateUnchanged: true };
});
await check("rejected maintenance does not poison the queue; verified import and resume succeed", async () => {
  const response = await request("POST", "/import", body, { "X-Backend-Sha256": sha256(body) });
  const imported = await response.json();
  assert(response.ok && imported.verified, JSON.stringify(imported));
  assert(await exported() === body, "valid import changed records");
  assert((await admin("POST", "/resume")).writes === "live", "resume failed");
  return { status: response.status, verified: imported.verified };
});
writeFileSync(resolve(outputDir, "maintenance.json"), JSON.stringify({ results }, null, 2) + "\n");
if (results.some((result) => !result.ok)) process.exitCode = 1;
