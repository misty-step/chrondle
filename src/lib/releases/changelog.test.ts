import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { parseChangelog } from "./changelog";
import { getAllVersions, loadAllReleases, loadRelease } from "./loader";

const fixture = `# Changelog

## Unreleased

- Not published.

## [2.0.1](https://github.com/example/app/compare/v2.0.0...v2.0.1) (2026-10-15)

### Bug Fixes

* **input:** reject invalid drafts ([abc1234](https://github.com/example/app/commit/abc1234))

# [2.0.0](https://github.com/example/app/compare/v1.0.0...v2.0.0) (2026-10-14)

### BREAKING CHANGES

Move saved games before upgrading. Roll back the code, not player data.

## Unreleased

- Do not attribute this to 2.0.0.
`;

describe("generated changelog consumer", () => {
  it("reads patch and major headings in generator order, preserving the notes", () => {
    const releases = parseChangelog(fixture);
    expect(releases.map(({ version, date }) => ({ version, date }))).toEqual([
      { version: "2.0.1", date: "2026-10-15" },
      { version: "2.0.0", date: "2026-10-14" },
    ]);
    expect(releases[0].notes).toContain("**input:** reject invalid drafts");
    expect(releases[1].notes).toContain("Move saved games before upgrading");
    expect(releases[1].notes).not.toContain("Do not attribute");
    expect(JSON.stringify(releases)).not.toContain("Not published");
  });

  it("accepts CRLF and plain generated release headings", () => {
    expect(parseChangelog("## 1.2.3 (2026-10-15)\r\n\r\nNotes.\r\n")).toEqual([
      { version: "1.2.3", date: "2026-10-15", notes: "Notes." },
    ]);
  });

  it("refuses missing generated history instead of claiming a stale manual version", () => {
    expect(() => parseChangelog("# Changelog\n## Unreleased\nNothing released")).toThrow(
      "no generated releases",
    );
  });

  it("uses the real source artifact for both the version list and detail lookup", () => {
    const expected = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
    expect(loadAllReleases()).toEqual(expected);
    expect(getAllVersions()).toEqual(expected.map(({ version }) => version));
    expect(loadRelease(`v${expected[0].version}`)).toEqual(expected[0]);
    expect(loadRelease(expected[0].version)).toEqual(expected[0]);
    expect(loadRelease("../../package.json")).toBeUndefined();
    expect(loadRelease("9999.0.0")).toBeUndefined();
  });
});
