"use node";
/**
 * Langfuse Singleton Module
 *
 * Serverless-safe Langfuse singleton + flush for Convex Node actions.
 * Telemetry is strictly non-throwing - pipeline output > observability.
 *
 * @module convex/lib/langfuse
 */

import Langfuse from "langfuse";

let langfuseInstance: Langfuse | null = null;

/**
 * Check if Langfuse is configured via environment variables.
 */
export function isLangfuseConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

/**
 * Get or create the Langfuse singleton instance.
 * Throws if Langfuse is not configured.
 */
export function getLangfuse(): Langfuse {
  if (!isLangfuseConfigured()) {
    throw new Error(
      "Langfuse is not configured: missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY",
    );
  }

  if (!langfuseInstance) {
    langfuseInstance = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_HOST,
      // Serverless settings: flush immediately, don't buffer
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return langfuseInstance;
}

/**
 * Safely flush Langfuse events before serverless function terminates.
 * Non-throwing - logs warning on failure.
 */
export async function flushLangfuse(): Promise<void> {
  if (!langfuseInstance) {
    return;
  }

  try {
    await langfuseInstance.flushAsync();
  } catch (error) {
    console.warn("[Langfuse] Flush failed:", error instanceof Error ? error.message : error);
    // Non-throwing: pipeline completion > telemetry
  }
}

/**
 * Shutdown Langfuse and clear the singleton.
 * Call during graceful shutdown if needed.
 */
export async function shutdownLangfuse(): Promise<void> {
  if (!langfuseInstance) {
    return;
  }

  try {
    await langfuseInstance.shutdownAsync();
  } catch (error) {
    console.warn("[Langfuse] Shutdown failed:", error instanceof Error ? error.message : error);
  } finally {
    langfuseInstance = null;
  }
}
