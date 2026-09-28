#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CI_CONVEX_URL = "https://handsome-raccoon-955.convex.cloud";

export function verifyCiBackend(env = process.env) {
  assert.equal(
    env.NEXT_PUBLIC_CONVEX_URL,
    CI_CONVEX_URL,
    "CI Convex target must be the existing development deployment handsome-raccoon-955",
  );
  assert.ok(!env.CONVEX_DEPLOY_KEY, "CI must not receive a Convex deployment credential");
}

export function verifyCiBuild(buildDir) {
  let foundBackend = false;
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        inspect(path);
      } else if (entry.name.endsWith(".js")) {
        const source = readFileSync(path, "utf8");
        // SDK error messages contain example deployment URLs, not client targets.
        // Reject our production host in any protocol while requiring the DEV binding.
        assert.ok(
          !source.includes("fleet-goldfish-183.convex."),
          `Production Convex URL in CI build: ${path}`,
        );
        if (source.includes(CI_CONVEX_URL)) foundBackend = true;
      }
    }
  }
  inspect(join(buildDir, "static"));
  assert.ok(foundBackend, "CI build must embed its development Convex URL");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyCiBackend();
    if (process.argv[2]) verifyCiBuild(process.argv[2]);
    console.log("CI Convex isolation: PASS (development only; no deployment credential)");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
