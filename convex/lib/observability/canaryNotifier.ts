"use node";

import type { AlertNotification } from "./alertEngine";
import { sanitizeErrorForLogging } from "../errorSanitization";

const DEFAULT_CANARY_ENDPOINT = "https://canary-obs.fly.dev";
const SERVICE = "chrondle";
const REQUEST_TIMEOUT_MS = 2_000;

const SEVERITY_TO_CANARY: Record<string, "error" | "warning" | "info"> = {
  critical: "error",
  warning: "warning",
  info: "info",
};

let warnedMissingKey = false;

export function resetCanaryNotifierState(): void {
  warnedMissingKey = false;
}

export async function sendToCanary(notification: AlertNotification): Promise<void> {
  const apiKey = getApiKey();

  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn("[Canary] Write key not configured, alerts will not be sent to Canary");
      warnedMissingKey = true;
    }
    return;
  }

  try {
    const response = await fetch(`${getEndpoint().replace(/\/$/, "")}/api/v1/errors`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service: SERVICE,
        environment: process.env.CANARY_ENVIRONMENT || process.env.NODE_ENV || "production",
        error_class: "ChrondleAlert",
        message: sanitizeErrorForLogging(notification.message),
        severity: SEVERITY_TO_CANARY[notification.rule.severity] || "info",
        context: {
          tags: {
            alert_name: notification.rule.name,
            severity: notification.rule.severity,
            alert_type: "observability",
            metric_type: getMetricType(notification.rule.name),
          },
          extras: {
            metrics: sanitizeCanaryValue(notification.metrics),
            alert_timestamp: new Date(notification.timestamp).toISOString(),
            alert_description: sanitizeErrorForLogging(notification.rule.description),
            alert_channels: notification.rule.channels,
          },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("[Canary] Failed to send alert:", notification.rule.name, response.status);
    }
  } catch (error) {
    console.error("[Canary] Failed to send alert:", error);
  }
}

function sanitizeCanaryValue(value: unknown, seen = new WeakSet<object>()): unknown {
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
    const sanitized = value.map((entry) => sanitizeCanaryValue(entry, seen));
    seen.delete(value);
    return sanitized;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    sanitized[key] = sanitizeCanaryValue(entry, seen);
  }

  seen.delete(value);
  return sanitized;
}

function getEndpoint(): string {
  return (
    process.env.CANARY_ENDPOINT?.trim() ||
    process.env.NEXT_PUBLIC_CANARY_ENDPOINT?.trim() ||
    DEFAULT_CANARY_ENDPOINT
  );
}

function getApiKey(): string {
  return process.env.CANARY_API_KEY?.trim() || process.env.NEXT_PUBLIC_CANARY_API_KEY?.trim() || "";
}

function getMetricType(ruleName: string): "pool_health" | "cost" | "quality" | "unknown" {
  if (ruleName.includes("Pool")) return "pool_health";
  if (ruleName.includes("Cost")) return "cost";
  if (ruleName.includes("Quality") || ruleName.includes("Failure")) return "quality";
  return "unknown";
}
