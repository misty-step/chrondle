/// <reference types="vite/client" />

/**
 * Convex Test Setup
 *
 * Exports modules for convex-test to discover Convex functions.
 * Matches all .ts/.js files while excluding test/config/setup files.
 *
 * Vite owns import.meta.glob and declares it through vite/client.
 * Convex deployment excludes this multi-dot test module from its entrypoints.
 */
export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.{ts,tsx}",
  "!./**/*.spec.{ts,tsx}",
  "!./**/*.config.ts",
  "!./**/*.setup.ts",
]);
