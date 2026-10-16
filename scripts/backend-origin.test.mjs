// @vitest-environment node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "vitest";
import { validateVar, validateEnvironment } from "../src/lib/env.schema.ts";

const cloudflare = "https://chrondle-backend.mistystep.io";
const native = "https://fleet-goldfish-183.convex.cloud";
const fixtures = {
  NEXT_PUBLIC_CONVEX_URL: cloudflare,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic",
  CLERK_SECRET_KEY: "sk_synthetic_never_print_this_value",
  STRIPE_SECRET_KEY: "sk_live_synthetic_never_print_this_value",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic_never_print_this_value",
  STRIPE_SYNC_SECRET: "synthetic_sync_never_print_this_value",
  STRIPE_PRICE_MONTHLY: "price_synthetic_monthly",
  STRIPE_PRICE_ANNUAL: "price_synthetic_annual",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_synthetic",
};

function cli(environment, changes = {}) {
  return spawnSync(process.execPath, ["scripts/verify-env-config.mjs", environment], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...fixtures, ...changes },
  });
}

test.each([
  cloudflare,
  native,
  "https://handsome-raccoon-955.convex.cloud",
  "https://chrondle-backend-preview.mistystep.io",
])("shared schema accepts the real HTTPS backend origin %s", (url) => {
  assert.equal(validateVar("NEXT_PUBLIC_CONVEX_URL", url).valid, true);
});

test.each([
  "http://chrondle-backend.mistystep.io",
  `${cloudflare}/`,
  `${cloudflare}/api`,
  `${cloudflare}?next=bad`,
  `${cloudflare}#bad`,
  `${cloudflare}:8443`,
  "https://owner:password@chrondle-backend.mistystep.io",
  "https://chrondle-backend.mistystep.io.evil.invalid",
  "https://fleet-goldfish-183.convex.cloud.evil.invalid",
  "https://unrelated.mistystep.io",
])("shared schema refuses non-origin or unrelated backend %s", (url) => {
  assert.equal(validateVar("NEXT_PUBLIC_CONVEX_URL", url).valid, false);
});

test.each([cloudflare, native])(
  "real production CLI and shared validator agree on serving origin %s",
  (url) => {
    assert.equal(
      validateEnvironment(
        "production",
        { ...fixtures, NEXT_PUBLIC_CONVEX_URL: url },
        { checkLiveMode: true },
      ).valid,
      true,
    );
    const result = cli("production", { NEXT_PUBLIC_CONVEX_URL: url });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(!/never_print_this_value/.test(result.stdout + result.stderr));
  },
);

test.each([
  "https://handsome-raccoon-955.convex.cloud",
  "https://chrondle-backend-preview.mistystep.io",
])("production validation refuses a valid nonproduction backend %s", (url) => {
  assert.equal(
    validateEnvironment("production", { ...fixtures, NEXT_PUBLIC_CONVEX_URL: url }).valid,
    false,
  );
  const result = cli("production", { NEXT_PUBLIC_CONVEX_URL: url });
  assert.equal(result.status, 1);
});

test("real CLI retains required Stripe/live-mode boundaries and emits no runtime values", () => {
  for (const changes of [
    { STRIPE_SYNC_SECRET: "short" },
    { STRIPE_SECRET_KEY: "sk_test_never_print_this_value" },
    { CLERK_SECRET_KEY: "" },
  ]) {
    const result = cli("production", changes);
    assert.equal(result.status, 1);
    assert.ok(!/never_print_this_value/.test(result.stdout + result.stderr));
  }
});

test("CI retains development-only and no-deploy-credential contract across shared validation", () => {
  assert.equal(
    cli("ci", { NEXT_PUBLIC_CONVEX_URL: "https://handsome-raccoon-955.convex.cloud" }).status,
    0,
  );
  for (const changes of [
    { NEXT_PUBLIC_CONVEX_URL: cloudflare },
    { NEXT_PUBLIC_CONVEX_URL: native },
    {
      NEXT_PUBLIC_CONVEX_URL: "https://handsome-raccoon-955.convex.cloud",
      CONVEX_DEPLOY_KEY: "synthetic",
    },
  ]) {
    assert.equal(cli("ci", changes).status, 1);
  }
});
