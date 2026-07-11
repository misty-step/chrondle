import assert from "node:assert/strict";
import { test } from "vitest";

import { findRetiredProviderReferences } from "./check-provider-retirement.mjs";

test("active delivery surfaces do not depend on the retired hosting provider", async () => {
  assert.deepEqual(await findRetiredProviderReferences(), []);
});
