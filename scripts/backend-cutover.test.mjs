// @vitest-environment node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { test } from "vitest";
import { parse } from "yaml";

const workflow = parse(readFileSync(".github/workflows/deploy.yml", "utf8"));
const native = "https://fleet-goldfish-183.convex.cloud";
const cloudflare = "https://chrondle-backend.mistystep.io";
function selected(step, prepare, origin) {
  return (
    !step.if ||
    runInNewContext(step.if, {
      inputs: { prepare_cloudflare_backend: prepare },
      env: { NEXT_PUBLIC_CONVEX_URL: origin },
      endsWith: (value, suffix) => value.toLowerCase().endsWith(suffix.toLowerCase()),
    })
  );
}

// These execute the actual workflow's boolean expressions, not a hosted deploy.
test.each([
  [undefined, native, true, false],
  [false, native, true, false],
  [false, cloudflare, false, true],
  [true, native, false, true],
  [true, cloudflare, false, true],
])("actual release selection prepare=%s origin=%s", (prepare, origin, convex, cf) => {
  const active = workflow.jobs.backend.steps.filter((step) => selected(step, prepare, origin));
  const commands = active.map((step) => step.run || "").join("\n");
  assert.equal(commands.includes("bun run deploy:backend"), convex);
  assert.equal(commands.includes("wrangler deploy --env production"), cf);
  assert.equal(commands.includes("wrangler secret bulk --env production"), cf);
  assert.equal(commands.includes("production-bindings.mjs --check"), cf);
  assert.equal(commands.includes("bun run deploy:verify"), prepare !== true);
  assert.equal(selected(workflow.jobs.cloudflare, prepare, origin), prepare !== true);
  const install = active.find((step) => step.name === "Install dependencies");
  assert.equal(install.env, undefined);
  if (cf) assert.ok(!commands.includes("bun run deploy:backend"));
  if (prepare !== true && cf) {
    assert.ok(commands.indexOf("bun run deploy:verify") > commands.indexOf("wrangler secret bulk"));
  }
});

test("one environment URL drives backend selection, frontend compiler and explicit runtime binding", () => {
  for (const job of [workflow.jobs.backend, workflow.jobs.cloudflare]) {
    assert.equal(job.env.NEXT_PUBLIC_CONVEX_URL, "${{ secrets.NEXT_PUBLIC_CONVEX_URL }}");
  }
  const web = workflow.jobs.cloudflare.steps;
  assert.equal(
    web.find((step) => step.run === "bun run build:cf").env.NEXT_PUBLIC_CONVEX_URL,
    "${{ secrets.NEXT_PUBLIC_CONVEX_URL }}",
  );
  assert.ok(
    web
      .find((step) => step.id === "activate")
      .run.includes('--var "NEXT_PUBLIC_CONVEX_URL:$NEXT_PUBLIC_CONVEX_URL"'),
  );
  assert.ok(
    web
      .find((step) => step.id === "previous")
      .run.includes('binding.name === "NEXT_PUBLIC_CONVEX_URL"'),
  );
  assert.deepEqual(workflow.concurrency, {
    group: "chrondle-production",
    "cancel-in-progress": false,
  });
});

test.each([
  ["true", 77],
  ["false", 1],
  ["", 1],
])(
  "actual rollback shell refuses incompatible or unknown origin (compatible=%j)",
  (compatible, exit) => {
    const step = workflow.jobs.cloudflare.steps.find(
      (step) => step.name === "Roll back Worker on failed activation or smoke",
    );
    const command = step.run
      .replaceAll("${{ steps.previous.outputs.backend_compatible }}", compatible)
      .replaceAll("${{ steps.previous.outputs.version }}", "synthetic-version")
      // Sentinel is control-flow proof only; never call a deployment tool in a unit test.
      .replace(/^\s*bunx wrangler rollback.*$/m, "exit 77");
    const result = spawnSync("bash", ["-e", "-c", command], { encoding: "utf8", env: {} });
    assert.equal(result.status, exit, result.stdout + result.stderr);
  },
);
