#!/usr/bin/env node
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

// Only a healthy old revision is propagation. Errors must still trigger rollback.
export async function verifyWorkerReadiness({
  origin,
  revision,
  timeoutMs = 60_000,
  intervalMs = 2_000,
  healthPath = "/api/health",
  isHealthy = (health) => health.status === "ok" && health.checks?.convex === "ok",
}) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? "")) throw new Error("Missing exact release revision");
  const deadline = performance.now() + timeoutMs;
  let attempt = 0;
  while (performance.now() < deadline) {
    const url = new URL(healthPath, origin);
    url.searchParams.set("readiness", `${Date.now()}-${attempt++}`);
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(
        Math.max(1, Math.ceil(Math.min(10_000, deadline - performance.now()))),
      ),
    });
    if (!response.ok) throw new Error(`Worker health HTTP ${response.status} on ${origin}`);
    const health = await response.json();
    if (!isHealthy(health) || !/^[a-f0-9]{40}$/.test(health.revision ?? "")) {
      throw new Error(`Worker health error on ${origin}`);
    }
    if (health.revision === revision) {
      console.log(`Worker ready on ${origin}: ${revision} (attempt ${attempt})`);
      return health;
    }
    console.log(`Waiting for ${revision} on ${origin}; observed ${health.revision}`);
    await setTimeout(Math.max(0, Math.min(intervalMs, deadline - performance.now())));
  }
  throw new Error(`Wrong Worker revision on ${origin} after ${timeoutMs}ms`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error("Provide at least one Worker origin");
  await Promise.all(
    process.argv.slice(2).map((origin) =>
      verifyWorkerReadiness({
        origin,
        revision: process.env.GITHUB_SHA,
      }),
    ),
  );
}
