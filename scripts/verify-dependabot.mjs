#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";

// MIS-178: the updater must own the lockfile the application actually installs.
export function verifyDependabotConfig(root = process.cwd()) {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const config = parse(readFileSync(resolve(root, ".github/dependabot.yml"), "utf8"));
  assert.match(manifest.packageManager, /^bun@/, "Chrondle must declare its Bun package manager");
  assert.ok(existsSync(resolve(root, "bun.lock")), "Bun's text lockfile must be present");
  for (const lock of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"]) {
    assert.ok(!existsSync(resolve(root, lock)), `Conflicting lockfile: ${lock}`);
  }
  const rootUpdaters = config.updates.filter(
    (update) =>
      update["package-ecosystem"] !== "github-actions" &&
      [update.directory, ...(update.directories ?? [])].includes("/"),
  );
  assert.equal(rootUpdaters.length, 1, "Exactly one updater must own the root dependencies");
  const updater = rootUpdaters[0];
  assert.equal(updater["package-ecosystem"], "bun", "bun.lock requires Dependabot's bun ecosystem");
  assert.ok(
    ["daily", "weekly"].includes(updater.schedule?.interval),
    "Dependency updates must run at least weekly to satisfy the nine-day health deadline",
  );
  assert.ok(
    (updater["open-pull-requests-limit"] ?? 5) > 0,
    "Dependency version updates must not be disabled",
  );
}

// A green unrelated workflow (or GitHub Actions updater) cannot certify Bun updates.
export function verifyDependabotRuns(runs, now = Date.now()) {
  const latest = runs
    .filter((run) => /^bun in \/(?: |$)/.test(run.name) && run.status === "completed")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  assert.ok(latest, "No completed root Bun updater run in the last nine days");
  assert.equal(
    latest.conclusion,
    "success",
    `Bun updater ${latest.conclusion}: ${latest.html_url}`,
  );
  const age = now - Date.parse(latest.created_at);
  assert.ok(age >= 0 && age <= 9 * 86400_000, `Bun updater success is stale: ${latest.html_url}`);
  return latest.html_url;
}

function main() {
  verifyDependabotConfig();
  console.log("PASS Dependabot owns the Bun lockfile and runs at least weekly");
  if (!process.argv.includes("--runs")) return;
  const repository = process.env.GITHUB_REPOSITORY;
  assert.match(repository ?? "", /^[\w.-]+\/[\w.-]+$/, "GITHUB_REPOSITORY is required");
  const since = new Date(Date.now() - 9 * 86400_000).toISOString();
  const pages = JSON.parse(
    execFileSync(
      "gh",
      [
        "api",
        "--paginate",
        "--slurp",
        `repos/${repository}/actions/runs?event=dynamic&created=%3E%3D${since}&per_page=100`,
      ],
      { encoding: "utf8", timeout: 60_000 },
    ),
  );
  console.log(
    `PASS Bun updater: ${verifyDependabotRuns(pages.flatMap((page) => page.workflow_runs))}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
