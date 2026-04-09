/**
 * Sentry Client Initialization & Helpers
 *
 * Lightweight client telemetry bridge.
 *
 * Client-side Sentry added too much permanent bundle weight for the app shell,
 * so browser error capture is forwarded through Canary instead while
 * preserving the same call sites and API surface.
 */

import { logger } from "@/lib/logger";
import { captureCanaryException } from "./canary";
import type { SentryContext } from "./types";

export type { SentryContext };

let isInitialized = false;

/**
 * Initialize Sentry client-side
 * Safe to call multiple times (guards against re-init)
 */
export function initSentryClient(): void {
  if (isInitialized) return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  // No-op if DSN not configured
  if (!dsn) {
    logger.debug("[Sentry] Client DSN not configured, skipping init");
    return;
  }

  isInitialized = true;
  logger.debug("[Sentry] Client initialized via Canary bridge", {
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}

/**
 * Capture exception with context
 * @param error - Error to capture
 * @param context - Additional tags/extras
 */
export function captureClientException(error: unknown, context?: SentryContext): void {
  if (!isInitialized) {
    logger.debug("[Sentry] Not initialized, forwarding exception to Canary only", {
      error,
      context,
    });
  }

  void captureCanaryException(error, context);
}

/**
 * Set user context with hashed identifiers
 * @param userId - User ID (will be hashed)
 * @param authState - Authentication state
 */
export function setUserContext(userId?: string, authState?: "signed_in" | "anon"): void {
  if (!isInitialized) return;

  logger.debug("[Sentry] Client user context updated", { hasUserId: !!userId, authState });
}

/**
 * Add breadcrumb for debugging context
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (!isInitialized) return;

  logger.debug("[Sentry] Client breadcrumb", { message, data });
}
