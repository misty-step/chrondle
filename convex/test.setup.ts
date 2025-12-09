/**
 * Convex Test Setup
 *
 * Exports modules for convex-test to discover Convex functions.
 * Matches all .ts/.js files while excluding test/config/setup files.
 *
 * Note: import.meta.glob is a Vite-specific feature that's available
 * at runtime but not in TypeScript's type system.
 */
// @ts-expect-error - import.meta.glob is a Vite-specific feature
export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.test.{ts,tsx}",
  "!./**/*.spec.{ts,tsx}",
  "!./**/*.config.ts",
  "!./**/*.setup.ts",
]);
