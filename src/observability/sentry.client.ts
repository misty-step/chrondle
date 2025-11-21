/**
 * Sentry Client Initialization & Helpers
 *
 * Bootstraps Sentry for client-side error tracking with:
 * - No-op when DSN missing (dev-friendly)
 * - User context with hashed IDs
 * - Configurable sampling rates
 * - Release tracking
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

  try {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

      // Performance monitoring
      tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.1"),

      // Session replay
      replaysSessionSampleRate: parseFloat(
        process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || "0.1",
      ),
      replaysOnErrorSampleRate: 1.0, // Always capture on error

      // Integrations
      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Filter out noisy errors
      beforeSend(event) {
        // Filter common browser extension errors
        if (event.exception?.values?.[0]?.value?.includes("Extension context invalidated")) {
          return null;
        }
        return event;
      },
    });

    isInitialized = true;
    logger.debug("[Sentry] Client initialized", {
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    });
  } catch (error) {
    logger.error("[Sentry] Failed to initialize client", { error });
    // Don't throw - graceful degradation
  }
}

/**
 * Capture exception with context
 * @param error - Error to capture
 * @param context - Additional tags/extras
 */
export function captureClientException(error: unknown, context?: SentryContext): void {
  if (!isInitialized) {
    logger.debug("[Sentry] Not initialized, skipping exception capture", { error, context });
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
