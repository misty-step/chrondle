import { readFileSync } from "fs";
import { parseChangelog } from "./changelog";

/** Build-time only: notes and versions come from the same generated artifact. */
export function loadAllReleases() {
  return parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
}

export function loadRelease(version: string) {
  return loadAllReleases().find((release) => release.version === version.replace(/^v/, ""));
}

export function getAllVersions(): string[] {
  return loadAllReleases().map((release) => release.version);
}
