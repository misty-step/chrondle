"use node";
/**
 * Langfuse OpenTelemetry Instrumentation
 *
 * Initializes OpenTelemetry with Langfuse span processor for tracing.
 * Safe for serverless environments - idempotent initialization.
 *
 * @module convex/lib/instrumentation
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

let sdk: NodeSDK | null = null;
let initialized = false;

/**
 * Check if Langfuse is configured via environment variables.
 */
export function isLangfuseConfigured(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

/**
 * Initialize OpenTelemetry with Langfuse span processor.
 * Safe to call multiple times - will only initialize once.
 */
export function initLangfuseOtel(): void {
  if (initialized) return;
  if (!isLangfuseConfigured()) {
    initialized = true;
    return;
  }

  try {
    sdk = new NodeSDK({
      spanProcessors: [new LangfuseSpanProcessor()],
    });
    sdk.start();
    initialized = true;
  } catch (error) {
    console.warn(
      "[Langfuse] Failed to initialize OpenTelemetry:",
      error instanceof Error ? error.message : error,
    );
    initialized = true; // Mark as initialized to prevent retries
  }
}

/**
 * Shutdown the OpenTelemetry SDK gracefully.
 * Call during graceful shutdown if needed.
 */
export async function shutdownLangfuseOtel(): Promise<void> {
  if (!sdk) return;

  try {
    await sdk.shutdown();
  } catch (error) {
    console.warn("[Langfuse] Shutdown failed:", error instanceof Error ? error.message : error);
  } finally {
    sdk = null;
    initialized = false;
  }
}
