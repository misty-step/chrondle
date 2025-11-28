/**
 * Alert Engine for proactive issue detection.
 *
 * Monitors metrics and triggers multi-channel notifications when thresholds are breached.
 * Prevents silent failures (pool depletion, cost spikes, quality degradation).
 *
 * Deep module pattern: Simple checkAlerts() interface hides:
 * - Cooldown state management
 * - Channel routing by severity
 * - Alert condition evaluation
 * - Notification delivery
 */

import type { Metrics } from "./metricsCollector";

/**
 * Alert notification channel types.
 */
export type AlertChannel = "sentry" | "email";

/**
 * Alert severity levels.
 * - critical: Immediate action required (production impact)
 * - warning: Attention needed (potential issue)
 * - info: Informational (no action required)
 */
export type AlertSeverity = "critical" | "warning" | "info";

/**
 * Alert rule definition.
 *
 * Declarative rule specifying:
 * - What to check (condition function)
 * - How severe (severity level)
 * - Where to notify (channels array)
 * - How often (cooldown period)
 */
export interface AlertRule {
  /** Unique rule identifier */
  name: string;

  /** Condition function that returns true when alert should fire */
  condition: (metrics: Metrics) => boolean;

  /** Alert severity level */
  severity: AlertSeverity;

  /** Notification channels for this alert */
  channels: AlertChannel[];

  /** Milliseconds between repeated alerts (prevents alert fatigue) */
  cooldown: number;

  /** Optional description for documentation */
  description?: string;
}

/**
 * Alert notification payload sent to channels.
 */
export interface AlertNotification {
  /** Rule that triggered this alert */
  rule: AlertRule;

  /** Metrics snapshot at time of alert */
  metrics: Metrics;

  /** Timestamp when alert fired */
  timestamp: number;

  /** Alert message (generated from rule and metrics) */
  message: string;
}

/**
 * Standard alert rules for event generation monitoring.
 *
 * Conservative thresholds to avoid alert fatigue while catching critical issues.
 */
export const STANDARD_ALERT_RULES: AlertRule[] = [
  {
    name: "Pool Depletion Imminent",
    description: "Event pool running low - less than 30 days of puzzles remaining",
    condition: (metrics) => metrics.poolHealth.daysUntilDepletion < 30,
    severity: "critical",
    channels: ["sentry", "email"],
    cooldown: 24 * 60 * 60 * 1000, // 24 hours
  },
  {
    name: "Cost Spike Detected",
    description: "Today's cost exceeds 7-day average by 2x",
    condition: (metrics) => metrics.cost.costToday > metrics.cost.cost7DayAvg * 2,
    severity: "warning",
    channels: ["sentry"],
    cooldown: 6 * 60 * 60 * 1000, // 6 hours
  },
  {
    name: "Quality Degradation",
    description: "Average quality score below acceptable threshold (0.7)",
    condition: (metrics) => metrics.quality.avgQualityScore < 0.7,
    severity: "warning",
    channels: ["sentry"],
    cooldown: 12 * 60 * 60 * 1000, // 12 hours
  },
  {
    name: "Generation Failure Spike",
    description: "More than 50% of generation attempts failing",
    condition: (metrics) => metrics.quality.failureRate > 0.5,
    severity: "critical",
    channels: ["sentry", "email"],
    cooldown: 1 * 60 * 60 * 1000, // 1 hour
  },
];
