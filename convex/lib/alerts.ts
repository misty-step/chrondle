"use node";
/**
 * Alert orchestration for event generation system.
 *
 * Integrates AlertEngine with metrics collection and multi-channel notifications.
 * Called post-batch to detect pool depletion, cost spikes, quality degradation.
 *
 * Deep module pattern: Simple runAlertChecks() interface hides:
 * - Metrics aggregation from multiple sources
 * - AlertEngine initialization and rule evaluation
 * - Notifier setup and channel routing
 * - Logging and error handling
 */

import type { ActionCtx } from "../_generated/server";
import { getMetrics } from "./observability/metricsService";
import { AlertEngine, STANDARD_ALERT_RULES } from "./observability/alertEngine";
import { sendToSentry } from "./observability/sentryNotifier";
import { sendEmail } from "./observability/emailNotifier";
import type { AlertChannel, Notifier } from "./observability/alertEngine";

/**
 * Run alert checks after batch generation completes.
 *
 * Aggregates metrics from last 24 hours, evaluates alert rules,
 * and sends notifications via configured channels (Sentry, email).
 *
 * @param ctx - Action context with database access
 */
export async function runAlertChecks(ctx: ActionCtx): Promise<void> {
  try {
    // Aggregate metrics from last 24 hours
    const metrics = await getMetrics(ctx, "24h");

    // Set up notifiers for each channel
    const notifiers = new Map<AlertChannel, Notifier>([
      ["sentry", sendToSentry],
      ["email", sendEmail],
    ]);

    // Create AlertEngine with standard rules and notifiers
    const alertEngine = new AlertEngine(STANDARD_ALERT_RULES, notifiers);

    // Evaluate all rules and fire alerts
    const firedAlerts = await alertEngine.checkAlerts(metrics);

    // Log results
    if (firedAlerts.length > 0) {
      console.log(`[Alerts] Fired ${firedAlerts.length} alert(s):`, firedAlerts);
    } else {
      console.log("[Alerts] All metrics within acceptable thresholds");
    }
  } catch (error) {
    console.error("[Alerts] Failed to run alert checks:", error);
    // Don't throw - graceful degradation, batch should complete even if alerts fail
  }
}
