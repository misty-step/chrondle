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

/**
 * Notifier function signature for sending alerts to channels.
 */
export type Notifier = (notification: AlertNotification) => Promise<void>;

/**
 * Alert Engine with cooldown management.
 *
 * Deep module implementation:
 * - Simple checkAlerts() interface
 * - Hides cooldown state tracking
 * - Hides channel routing logic
 * - Hides notification delivery
 */
export class AlertEngine {
  private lastAlertTimes: Map<string, number> = new Map();
  private rules: AlertRule[];
  private notifiers: Map<AlertChannel, Notifier>;

  /**
   * Creates an AlertEngine instance.
   *
   * @param rules - Alert rules to evaluate (defaults to STANDARD_ALERT_RULES)
   * @param notifiers - Notification delivery functions by channel
   */
  constructor(rules: AlertRule[] = STANDARD_ALERT_RULES, notifiers: Map<AlertChannel, Notifier>) {
    this.rules = rules;
    this.notifiers = notifiers;
  }

  /**
   * Checks all alert rules against current metrics.
   * Fires alerts for triggered rules that are not in cooldown.
   *
   * @param metrics - Current metrics snapshot
   * @returns Array of fired alert names (for logging/debugging)
   */
  async checkAlerts(metrics: Metrics): Promise<string[]> {
    const now = Date.now();
    const firedAlerts: string[] = [];

    for (const rule of this.rules) {
      // Evaluate condition
      if (!rule.condition(metrics)) {
        continue;
      }

      // Check cooldown
      if (this.isInCooldown(rule.name, now)) {
        continue;
      }

      // Fire alert
      await this.fireAlert(rule, metrics, now);
      firedAlerts.push(rule.name);

      // Update cooldown tracking
      this.lastAlertTimes.set(rule.name, now);
    }

    return firedAlerts;
  }

  /**
   * Checks if a rule is currently in cooldown period.
   *
   * @param ruleName - Name of the rule to check
   * @param now - Current timestamp
   * @returns True if rule is in cooldown, false otherwise
   */
  private isInCooldown(ruleName: string, now: number): boolean {
    const lastAlertTime = this.lastAlertTimes.get(ruleName);
    if (!lastAlertTime) {
      return false;
    }

    const rule = this.rules.find((r) => r.name === ruleName);
    if (!rule) {
      return false;
    }

    const timeSinceLastAlert = now - lastAlertTime;
    return timeSinceLastAlert < rule.cooldown;
  }

  /**
   * Fires an alert by sending notifications to all configured channels.
   *
   * @param rule - Alert rule that triggered
   * @param metrics - Metrics snapshot
   * @param timestamp - Alert timestamp
   */
  private async fireAlert(rule: AlertRule, metrics: Metrics, timestamp: number): Promise<void> {
    const message = this.generateAlertMessage(rule, metrics);

    const notification: AlertNotification = {
      rule,
      metrics,
      timestamp,
      message,
    };

    // Send notifications to all channels in parallel
    const notificationPromises = rule.channels.map(async (channel) => {
      const notifier = this.notifiers.get(channel);
      if (notifier) {
        await notifier(notification);
      }
    });

    await Promise.all(notificationPromises);
  }

  /**
   * Generates a human-readable alert message from rule and metrics.
   *
   * @param rule - Alert rule
   * @param metrics - Metrics snapshot
   * @returns Formatted alert message
   */
  private generateAlertMessage(rule: AlertRule, metrics: Metrics): string {
    const parts = [`[${rule.severity.toUpperCase()}] ${rule.name}`];

    if (rule.description) {
      parts.push(rule.description);
    }

    // Add relevant metric values based on rule name
    if (rule.name.includes("Pool Depletion")) {
      parts.push(
        `Days until depletion: ${metrics.poolHealth.daysUntilDepletion}`,
        `Unused events: ${metrics.poolHealth.unusedEvents}`,
      );
    } else if (rule.name.includes("Cost Spike")) {
      parts.push(
        `Today's cost: $${metrics.cost.costToday.toFixed(2)}`,
        `7-day avg: $${metrics.cost.cost7DayAvg.toFixed(2)}`,
      );
    } else if (rule.name.includes("Quality Degradation")) {
      parts.push(
        `Avg quality score: ${(metrics.quality.avgQualityScore * 100).toFixed(1)}%`,
        `Failure rate: ${(metrics.quality.failureRate * 100).toFixed(1)}%`,
      );
    } else if (rule.name.includes("Failure Spike")) {
      parts.push(
        `Failure rate: ${(metrics.quality.failureRate * 100).toFixed(1)}%`,
        `Top failures: ${metrics.quality.topFailureReasons.map((r) => r.reason).join(", ")}`,
      );
    }

    return parts.join("\n");
  }

  /**
   * Resets cooldown tracking for a specific rule (for testing).
   *
   * @param ruleName - Name of rule to reset
   */
  resetCooldown(ruleName: string): void {
    this.lastAlertTimes.delete(ruleName);
  }

  /**
   * Resets all cooldown tracking (for testing).
   */
  resetAllCooldowns(): void {
    this.lastAlertTimes.clear();
  }
}
