// @vitest-environment node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(new URL("../.github/workflows/backend-preview.yml", import.meta.url), "utf8"),
);

for (const jobName of ["preview", "frontend"]) {
  test(`${jobName} installs trusted dependencies without downloading CUDA`, () => {
    const job = workflow.jobs[jobName];
    const installs = job.steps.filter(({ run }) => run?.startsWith("bun install"));
    assert.equal(installs.length, 1);
    const [install] = installs;
    assert.equal(install.run, "bun install --frozen-lockfile");
    assert.deepEqual(install.env, { ONNXRUNTIME_NODE_INSTALL_CUDA: "skip" });
    // Keep the exception install-scoped: it must not alter build/deploy settings.
    assert.equal(job.env.ONNXRUNTIME_NODE_INSTALL_CUDA, undefined);
  });
}
