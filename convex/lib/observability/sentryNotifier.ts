"use node";
/**
 * Sentry Alert Notifier
 *
 * Captures alert notifications as Sentry events for centralized error tracking.
 * Maps alert severity to Sentry levels, includes full metric context.
 *
 * Deep module pattern: Simple notify() interface hides:
 * - Sentry SDK initialization
 * - Severity level mapping
 * - Context enrichment (tags, extras)
 * - Error handling and graceful degradation
 */

import * as Sentry from "@sentry/nextjs";
import type { AlertNotification } from "./alertEngine";

/**
 * Alert severity to Sentry level mapping.
 * - critical → error (requires immediate attention)
 * - warning → warning (needs attention)
 * - info → info (informational)
 */
const SEVERITY_TO_LEVEL: Record<string, Sentry.SeverityLevel> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

let isInitialized = false;

/**
 * Reset initialization state (for testing).
 * @internal
 */
export function resetSentryInit(): void {
  isInitialized = false;
}

/**
 * Initialize Sentry for Convex actions.
 * Safe to call multiple times (guards against re-init).
 */
function initSentry(): boolean {
  if (isInitialized) return true;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.warn("[Sentry] DSN not configured, alerts will not be sent to Sentry");
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
      release: process.env.SENTRY_RELEASE,
      tracesSampleRate: 0, // Disable performance tracking for alerts
    });

    isInitialized = true;
    console.log("[Sentry] Initialized for alert notifications");
    return true;
  } catch (error) {
    console.error("[Sentry] Failed to initialize:", error);
    return false;
  }
}

/**
 * Send alert notification to Sentry as an event.
 *
 * @param notification - Alert notification to send
 */
export async function sendToSentry(notification: AlertNotification): Promise<void> {
  const initialized = initSentry();

  if (!initialized) {
    console.warn("[Sentry] Not initialized, skipping alert:", notification.rule.name);
    return;
  }

  try {
    Sentry.withScope((scope) => {
      // Set severity level
      const level = SEVERITY_TO_LEVEL[notification.rule.severity] || "info";
      scope.setLevel(level);

      // Add tags for filtering in Sentry UI
      scope.setTag("alert_name", notification.rule.name);
      scope.setTag("severity", notification.rule.severity);
      scope.setTag("alert_type", "observability");

      // Determine metric type from rule name
      let metricType = "unknown";
      if (notification.rule.name.includes("Pool")) {
        metricType = "pool_health";
      } else if (notification.rule.name.includes("Cost")) {
        metricType = "cost";
      } else if (
        notification.rule.name.includes("Quality") ||
        notification.rule.name.includes("Failure")
      ) {
        metricType = "quality";
      }
      scope.setTag("metric_type", metricType);

      // Add full metric context as extras
      scope.setExtra("metrics", notification.metrics);
      scope.setExtra("alert_timestamp", new Date(notification.timestamp).toISOString());
      scope.setExtra("alert_description", notification.rule.description);
      scope.setExtra("alert_channels", notification.rule.channels);

      // Capture as message (not exception) with alert details
      Sentry.captureMessage(notification.message, level);
    });

    console.log(`[Sentry] Alert sent: ${notification.rule.name} (${notification.rule.severity})`);
  } catch (error) {
    console.error("[Sentry] Failed to send alert:", error);
    // Graceful degradation - don't throw, just log
  }
}
