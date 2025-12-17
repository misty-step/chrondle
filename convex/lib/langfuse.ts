"use node";
/**
 * Langfuse Configuration Module
 *
 * Re-exports configuration utilities from instrumentation module.
 * Maintained for backwards compatibility with existing imports.
 *
 * @module convex/lib/langfuse
 */

export { isLangfuseConfigured, initLangfuseOtel, shutdownLangfuseOtel } from "./instrumentation";
