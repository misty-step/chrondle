#!/usr/bin/env node
/**
 * Verifies that a Canary key is the raw production bearer secret and is scoped
 * narrowly enough for public/server ingest use.
 *
 * Shape validation alone cannot distinguish ingest-only keys from admin keys.
 * This script proves the deployed secret can write errors while read/admin
 * surfaces remain forbidden.
 */

const RAW_CANARY_KEY_PATTERN = /^sk_live_[A-Za-z0-9_-]{24}$/;

const endpoint = (process.env.CANARY_ENDPOINT || "https://canary-obs.fly.dev").replace(/\/$/, "");
const apiKey = process.env.CANARY_API_KEY?.trim() || "";
const label = process.env.CANARY_SCOPE_LABEL || "CANARY_API_KEY";
const service = process.env.CANARY_SERVICE || "chrondle";
const environment = process.env.CANARY_ENVIRONMENT || "production";

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function assertRawKeyShape() {
  if (!apiKey) {
    fail(`${label} is missing`);
  }
  if (!RAW_CANARY_KEY_PATTERN.test(apiKey)) {
    fail(`${label} must be the raw sk_live_ Canary key, not a KEY-* id`);
  }
}

async function request(path, init = {}) {
  return fetch(`${endpoint}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function assertStatus(name, response, expectedStatus) {
  if (response.status !== expectedStatus) {
    fail(
      `${label} ${name} returned HTTP ${response.status}; expected ${expectedStatus} for an ingest-only key`,
    );
  }
  console.log(`✓ ${label} ${name}`);
}

async function main() {
  assertRawKeyShape();

  const probeNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ingest = await request("/api/v1/errors", {
    method: "POST",
    body: JSON.stringify({
      service,
      environment,
      error_class: "CanaryScopeProbe",
      message: `Canary ingest-only scope probe ${probeNonce}`,
      severity: "info",
      context: {
        tags: {
          source: "chrondle.deploy.canary_scope_probe",
          key_label: label,
        },
        extras: {
          git_sha: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "local",
        },
      },
    }),
  });
  await assertStatus("can write /api/v1/errors", ingest, 201);

  const read = await request(`/api/v1/query?service=${encodeURIComponent(service)}&window=1h`);
  await assertStatus("cannot read /api/v1/query", read, 403);

  const admin = await request("/api/v1/keys");
  await assertStatus("cannot access /api/v1/keys", admin, 403);

  console.log(`✅ ${label} is a live ingest-only Canary key`);
}

main().catch((error) => {
  fail(
    `${label} scope validation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
});
