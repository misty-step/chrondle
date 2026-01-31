/**
 * Release Content Loader
 *
 * Loads pre-generated release content from content/releases/ directory.
 * Used by the /releases pages at build time for SSG.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Release, ReleaseManifest, ReleaseWithNotes } from "./types";

const CONTENT_DIR = join(process.cwd(), "content/releases");

/**
 * Load the release manifest.
 */
export function loadManifest(): ReleaseManifest | null {
  const path = join(CONTENT_DIR, "manifest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Load a single release with its product notes.
 */
export function loadRelease(version: string): ReleaseWithNotes | null {
  // Normalize version (handle with or without 'v' prefix)
  const normalized = version.startsWith("v") ? version : `v${version}`;
  const dir = join(CONTENT_DIR, normalized);

  const changelogPath = join(dir, "changelog.json");
  const notesPath = join(dir, "notes.md");

  if (!existsSync(changelogPath) || !existsSync(notesPath)) {
    return null;
  }

  const release: Release = JSON.parse(readFileSync(changelogPath, "utf-8"));
  const productNotes = readFileSync(notesPath, "utf-8");

  return { ...release, productNotes };
}

/**
 * Load all releases with their product notes.
 */
export function loadAllReleases(): ReleaseWithNotes[] {
  const manifest = loadManifest();
  if (!manifest) return [];

  return manifest.versions
    .map((v) => loadRelease(v))
    .filter((r): r is ReleaseWithNotes => r !== null);
}

/**
 * Get all version strings for SSG.
 */
export function getAllVersions(): string[] {
  const manifest = loadManifest();
  return manifest?.versions || [];
}
