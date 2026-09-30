#!/usr/bin/env node
import { pathToFileURL } from "node:url";

async function getJson(base, path) {
  const response = await fetch(new URL(path, base), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

export async function readback(base, expected) {
  const [health, receipt] = await Promise.all([
    getJson(base, "/api/health"),
    getJson(base, "/deployment.json"),
  ]);
  if (health.status !== "ok" || !/^[a-f0-9]{40}$/.test(health.revision)) {
    throw new Error("Production health or revision is invalid");
  }
  if (receipt.status !== "healthy" || receipt.revision !== health.revision) {
    throw new Error("Host smoke has not completed for the running revision");
  }
  for (const [key, value] of Object.entries(expected)) {
    if (String(receipt[key]) !== String(value)) {
      throw new Error(`Production ${key} does not match the observed deployment`);
    }
  }
  return { revision: health.revision, run_url: receipt.run_url, checks: health.checks };
}

async function main() {
  const waiting = process.argv.includes("--wait");
  const base = "https://chrondle.app";
  const expected = waiting
    ? { revision: process.env.GITHUB_SHA, run_id: process.env.GITHUB_RUN_ID, run_attempt: process.env.GITHUB_RUN_ATTEMPT }
    : {};
  if (waiting && Object.values(expected).some((value) => !value)) {
    throw new Error("Release observer requires the exact GitHub revision, run, and attempt");
  }
  const deadline = Date.now() + (waiting ? 20 * 60_000 : 0);
  let result;
  for (;;) {
    try {
      result = await readback(base, expected);
      break;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw new Error(`Native host rollout failed: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  for (const path of ["/", "/archive"]) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`${path} smoke returned HTTP ${response.status}`);
    await response.body?.cancel();
  }
  console.log(JSON.stringify({ target: base, status: "healthy", ...result }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
