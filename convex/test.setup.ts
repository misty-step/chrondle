/**
 * Convex Test Setup
 *
 * Exports modules for convex-test to discover Convex functions.
 * The glob pattern matches all .ts files with single extensions
 * (excluding .test.ts, .config.ts, etc.)
 *
 * Note: import.meta.glob is a Vite-specific feature that's available
 * at runtime but not in TypeScript's type system.
 */
// @ts-expect-error - import.meta.glob is a Vite-specific feature
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
