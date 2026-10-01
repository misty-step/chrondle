import type { AlertNotification } from "./alertEngine";
import { sanitizeErrorForLogging } from "../errorSanitization";

/**
 * Emit alert details to Convex platform logs without a separate transport.
 */
export async function sendToLog(notification: AlertNotification): Promise<void> {
  const payload = JSON.stringify(
    sanitizeLogValue({
      event: "generation.alert",
      rule: notification.rule.name,
      severity: notification.rule.severity,
      description: notification.rule.description,
      message: notification.message,
      metrics: notification.metrics,
      timestamp: notification.timestamp,
    }),
  );

  if (notification.rule.severity === "critical") {
    console.error("[Alerts]", payload);
  } else if (notification.rule.severity === "warning") {
    console.warn("[Alerts]", payload);
  } else {
    console.info("[Alerts]", payload);
  }
}

function sanitizeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return sanitizeErrorForLogging(value);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value.map((entry) => sanitizeLogValue(entry, seen));
    seen.delete(value);
    return sanitized;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    sanitized[key] = sanitizeLogValue(entry, seen);
  }

  seen.delete(value);
  return sanitized;
}
