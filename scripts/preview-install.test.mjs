// @vitest-environment node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(new URL("../.github/workflows/backend-preview.yml", import.meta.url), "utf8"),
);

for (const [filename, jobName] of [
  ["backend-preview.yml", "preview"],
  ["backend-preview.yml", "frontend"],
  ["size-limit.yml", "size"],
  ["release.yml", "release"],
]) {
  test(`${jobName} installs trusted dependencies without downloading CUDA`, () => {
    const source = parse(
      readFileSync(new URL("../.github/workflows/" + filename, import.meta.url), "utf8"),
    );
    const job = source.jobs[jobName];
    const installs = job.steps.filter(({ run }) => run?.startsWith("bun install"));
    assert.equal(installs.length, 1);
    const [install] = installs;
    assert.equal(install.run, "bun install --frozen-lockfile");
    assert.deepEqual(install.env, { ONNXRUNTIME_NODE_INSTALL_CUDA: "skip" });
    // Keep the exception install-scoped: it must not alter build/deploy settings.
    assert.equal(job.env?.ONNXRUNTIME_NODE_INSTALL_CUDA, undefined);
  });
}

test("frontend provisions pinned worker-build and wasm target before compiling", () => {
  const steps = workflow.jobs.frontend.steps;
  const index = (name) => steps.findIndex((step) => step.name === name);
  const inspect = index("Inspect existing Rust tools and cache");
  const rust = index("Setup Rust for the web Worker");
  const cache = index("Cache pinned worker-build");
  const install = index("Install pinned worker-build if needed");
  const build = index("Build the frontend with its source-owned preview bindings");
  assert.ok(inspect >= 0 && inspect < rust && rust < cache && cache < install && install < build);
  assert.equal(steps[rust].with.targets, "wasm32-unknown-unknown");
  assert.match(steps[cache].with.key, /worker-build-0\.8\.7/);
  assert.equal(steps[cache].with.path, "~/.cache/chrondle-worker-build");
  assert.match(steps[install].run, /worker-build --version/);
  assert.match(steps[install].run, /cargo install worker-build --version 0\.8\.7 --locked/);
  assert.match(steps[install].run, /GITHUB_PATH/);
});
