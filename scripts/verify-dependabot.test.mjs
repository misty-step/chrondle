// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { verifyDependabotConfig, verifyDependabotRuns } from "./verify-dependabot.mjs";

const scratch = join(homedir(), ".cache/tmp");
const roots = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function repository(ecosystem, extraLock) {
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, "chrondle-dependabot-"));
  roots.push(root);
  mkdirSync(join(root, ".github"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "bun@1.4.2" }));
  writeFileSync(join(root, "bun.lock"), "{}");
  writeFileSync(
    join(root, ".github/dependabot.yml"),
    `version: 2\nupdates:\n  - package-ecosystem: ${ecosystem}\n    directory: /\n    schedule:\n      interval: weekly\n`,
  );
  if (extraLock) writeFileSync(join(root, extraLock), "{}");
  return root;
}

test("the checked-in updater can update the application's installed lockfile (MIS-178)", () => {
  verifyDependabotConfig();
});

test("rejects the original npm/Bun mismatch before an update is scheduled", () => {
  expect(() => verifyDependabotConfig(repository("npm"))).toThrow(/bun ecosystem/);
});

test.each(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"])(
  "rejects ambiguous lockfile ownership: %s",
  (lock) => {
    expect(() => verifyDependabotConfig(repository("bun", lock))).toThrow(/Conflicting lockfile/);
  },
);

const now = Date.parse("2026-09-28T12:00:00Z");
const success = {
  name: "bun in / - Update #123",
  status: "completed",
  conclusion: "success",
  created_at: "2026-09-28T06:00:00Z",
  html_url: "https://github.com/misty-step/chrondle/actions/runs/123",
};

test("accepts a recent completed root Bun run regardless of API ordering", () => {
  const olderFailure = { ...success, conclusion: "failure", created_at: "2026-09-27T06:00:00Z" };
  expect(verifyDependabotRuns([olderFailure, success], now)).toBe(success.html_url);
});

test("a newer failure cannot be hidden by an older success or unrelated successful updater", () => {
  const failed = { ...success, conclusion: "failure", created_at: "2026-09-28T07:00:00Z" };
  const unrelated = { ...success, name: "github_actions in / - Update #456" };
  expect(() => verifyDependabotRuns([unrelated, success, failed], now)).toThrow(/updater failure/);
});

test.each([
  ["no runs", []],
  ["old npm ecosystem", [{ ...success, name: "npm_and_yarn in / - Update #123" }]],
  ["different directory", [{ ...success, name: "bun in /dagger - Update #123" }]],
  ["never completes", [{ ...success, status: "in_progress", conclusion: null }]],
])("fails closed when the root Bun updater has %s", (_label, runs) => {
  expect(() => verifyDependabotRuns(runs, now)).toThrow(/No completed root Bun updater/);
});

test.each(["2026-09-19T11:59:59Z", "invalid", "2026-09-29T00:00:00Z"])(
  "rejects stale or invalid success timestamps: %s",
  (created_at) => {
    expect(() => verifyDependabotRuns([{ ...success, created_at }], now)).toThrow(/stale/);
  },
);

test("allows the weekly schedule's two-day grace, but no longer", () => {
  expect(verifyDependabotRuns([{ ...success, created_at: "2026-09-19T12:00:00Z" }], now)).toBe(
    success.html_url,
  );
});
