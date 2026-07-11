import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

import { findRetiredProviderReferences } from "./check-provider-retirement.mjs";

test("active delivery surfaces do not depend on the retired hosting provider", async () => {
  assert.deepEqual(await findRetiredProviderReferences(), []);
});

test("CI enforces retirement and keeps the production route guard independent", async () => {
  const [dagger, ciWorkflow, deployWorkflow] = await Promise.all([
    readFile("dagger/src/index.ts", "utf8"),
    readFile(".github/workflows/ci.yml", "utf8"),
    readFile(".github/workflows/deploy.yml", "utf8"),
  ]);

  assert.ok(
    dagger.match(/verify:provider-retirement/g)?.length >= 2,
    "lint, type-check, and coverage must execute the provider-retirement guard",
  );
  assert.match(ciWorkflow, /production-route-guard:/);
  assert.match(ciWorkflow, /node scripts\/verify-webhook-redirect\.mjs/);

  for (const requiredPath of [
    '"convex\/\*\*\/\*.ts"',
    '"convex\/\*\*\/\*.js"',
    '"src\/lib\/duel\/\*\*"',
    '"src\/lib\/scoring.ts"',
    '"src\/types\/range.ts"',
  ]) {
    assert.ok(deployWorkflow.includes(requiredPath), `missing Convex deploy path: ${requiredPath}`);
  }
  assert.ok(
    !deployWorkflow.includes('"convex/**"'),
    "Convex docs must not trigger production deploys",
  );
});
