/**
 * Sentry Server Initialization & Helpers
 *
 * Bootstraps Sentry for server-side error tracking with:
 * - No-op when DSN missing
 * - User context with hashed IDs
 * - Release tracking
 * - Performance monitoring
 */

import * as Sentry from "@sentry/nextjs";
import { hashIdentifier } from "./hash";
import { logger } from "@/lib/logger";

let isInitialized = false;

export interface SentryContext {
  tags?: Record<string, string | number | boolean>;
  extras?: Record<string, unknown>;
  level?: "error" | "warning" | "info" | "debug";
}

/**
 * Initialize Sentry server-side
 * Safe to call multiple times (guards against re-init)
 */
export function initSentryServer(): void {
  if (isInitialized) return;

  const dsn = process.env.SENTRY_DSN;

  // No-op if DSN not configured
  if (!dsn) {
    logger.debug("[Sentry] Server DSN not configured, skipping init");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
      release: process.env.SENTRY_RELEASE,

      // Performance monitoring
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),

      // Don't capture profiling data by default (can be enabled via env)
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0"),
    });

    isInitialized = true;
    logger.debug("[Sentry] Server initialized", {
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      release: process.env.SENTRY_RELEASE,
    });
  } catch (error) {
    logger.error("[Sentry] Failed to initialize server", { error });
    // Don't throw - graceful degradation
  }
}

/**
 * Capture exception with context
 * @param error - Error to capture
 * @param context - Additional tags/extras
 */
export function captureServerException(error: unknown, context?: SentryContext): void {
  if (!isInitialized) {
    logger.error("[Sentry] Exception (not initialized)", { error, context });
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      if (context?.extras) {
        Object.entries(context.extras).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      if (context?.level) {
        scope.setLevel(context.level);
      }

      Sentry.captureException(error);
    });
  } catch (err) {
    logger.error("[Sentry] Failed to capture exception", { error, err });
  }
}

/**
 * Set user context with hashed identifiers
 * @param userId - User ID (will be hashed)
 * @param authState - Authentication state
 */
export function setUserContext(userId?: string, authState?: "signed_in" | "anon"): void {
  if (!isInitialized) return;

  try {
    Sentry.setUser(
      userId
        ? {
            id: hashIdentifier(userId),
            username: `user_${hashIdentifier(userId).slice(0, 6)}`,
          }
        : null,
    );

    if (authState) {
      Sentry.setTag("auth_state", authState);
    }
  } catch (error) {
    logger.error("[Sentry] Failed to set user context", { error });
  }
}

/**
 * Add breadcrumb for debugging context
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (!isInitialized) return;

  try {
    Sentry.addBreadcrumb({
      message,
      data,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    logger.error("[Sentry] Failed to add breadcrumb", { error });
  }
}
