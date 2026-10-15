import { parseChangelog } from "./changelog";

/** Next replaces this public constant at build time; no filesystem or API at runtime. */
export function loadAllReleases() {
  return parseChangelog(process.env.CHRONDLE_CHANGELOG ?? "");
}

export function loadRelease(version: string) {
  return loadAllReleases().find((release) => release.version === version.replace(/^v/, ""));
}

export function getAllVersions(): string[] {
  return loadAllReleases().map((release) => release.version);
}
