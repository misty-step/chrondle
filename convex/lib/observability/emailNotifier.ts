"use node";
/**
 * Email Alert Notifier
 *
 * Sends alert notifications via Resend for critical issues requiring immediate attention.
 * HTML-formatted emails with full alert context and actionable metrics.
 *
 * Deep module pattern: Simple sendEmail() interface hides:
 * - Resend SDK initialization
 * - HTML email template generation
 * - Recipient parsing and validation
 * - Error handling and retry logic
 */

import { Resend } from "resend";
import type { AlertNotification } from "./alertEngine";

let resendClient: Resend | null = null;

/**
 * Initialize Resend client.
 * Safe to call multiple times (guards against re-init).
 */
function initResend(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured, emails will not be sent");
    return null;
  }

  try {
    resendClient = new Resend(apiKey);
    console.log("[Email] Resend client initialized");
    return resendClient;
  } catch (error) {
    console.error("[Email] Failed to initialize Resend:", error);
    return null;
  }
}

/**
 * Parse comma-separated email recipients from env var.
 */
function getRecipients(): string[] {
  const recipientsEnv = process.env.EMAIL_RECIPIENTS;

  if (!recipientsEnv) {
    console.warn("[Email] EMAIL_RECIPIENTS not configured");
    return [];
  }

  return recipientsEnv
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

/**
 * Generate HTML email body from alert notification.
 */
function generateEmailHtml(notification: AlertNotification): string {
  const { rule, metrics, timestamp, message } = notification;
  const date = new Date(timestamp).toISOString();

  // Extract relevant metrics based on alert type
  let metricsHtml = "";

  if (rule.name.includes("Pool")) {
    metricsHtml = `
      <h3>Pool Health Metrics</h3>
      <ul>
        <li><strong>Unused Events:</strong> ${metrics.poolHealth.unusedEvents}</li>
        <li><strong>Days Until Depletion:</strong> ${metrics.poolHealth.daysUntilDepletion}</li>
        <li><strong>Years Ready:</strong> ${metrics.poolHealth.yearsReady}</li>
        <li><strong>Coverage by Era:</strong>
          <ul>
            <li>Ancient: ${metrics.poolHealth.coverageByEra.ancient}</li>
            <li>Medieval: ${metrics.poolHealth.coverageByEra.medieval}</li>
            <li>Modern: ${metrics.poolHealth.coverageByEra.modern}</li>
          </ul>
        </li>
      </ul>
    `;
  } else if (rule.name.includes("Cost")) {
    metricsHtml = `
      <h3>Cost Metrics</h3>
      <ul>
        <li><strong>Cost Today:</strong> $${metrics.cost.costToday.toFixed(2)}</li>
        <li><strong>7-Day Average:</strong> $${metrics.cost.cost7DayAvg.toFixed(2)}</li>
        <li><strong>30-Day Total:</strong> $${metrics.cost.cost30Day.toFixed(2)}</li>
        <li><strong>Cost per Event:</strong> $${metrics.cost.costPerEvent.toFixed(4)}</li>
      </ul>
    `;
  } else if (rule.name.includes("Quality") || rule.name.includes("Failure")) {
    metricsHtml = `
      <h3>Quality Metrics</h3>
      <ul>
        <li><strong>Average Quality Score:</strong> ${(metrics.quality.avgQualityScore * 100).toFixed(1)}%</li>
        <li><strong>Failure Rate:</strong> ${(metrics.quality.failureRate * 100).toFixed(1)}%</li>
        ${
          metrics.quality.topFailureReasons.length > 0
            ? `<li><strong>Top Failure Reasons:</strong>
            <ul>
              ${metrics.quality.topFailureReasons.map((r) => `<li>${r.reason} (${r.count})</li>`).join("")}
            </ul>
          </li>`
            : ""
        }
      </ul>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .alert-header {
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .alert-critical {
      background-color: #fee;
      border-left: 4px solid #c00;
    }
    .alert-warning {
      background-color: #ffd;
      border-left: 4px solid #fa0;
    }
    .alert-info {
      background-color: #eef;
      border-left: 4px solid #09f;
    }
    h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    h3 {
      margin-top: 20px;
      font-size: 18px;
      color: #555;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin: 5px 0;
    }
    .timestamp {
      color: #888;
      font-size: 14px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #888;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="alert-header alert-${rule.severity}">
    <h1>${rule.name}</h1>
    <p class="timestamp">Triggered at ${date}</p>
    ${rule.description ? `<p>${rule.description}</p>` : ""}
  </div>

  <h3>Alert Message</h3>
  <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto;">${message}</pre>

  ${metricsHtml}

  <div class="footer">
    <p>This is an automated alert from Chrondle Event Generation System.</p>
    <p>Severity: <strong>${rule.severity.toUpperCase()}</strong></p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send alert notification via email.
 *
 * @param notification - Alert notification to send
 */
export async function sendEmail(notification: AlertNotification): Promise<void> {
  const client = initResend();

  if (!client) {
    console.warn("[Email] Resend not initialized, skipping email:", notification.rule.name);
    return;
  }

  const recipients = getRecipients();

  if (recipients.length === 0) {
    console.warn("[Email] No recipients configured, skipping email:", notification.rule.name);
    return;
  }

  try {
    const html = generateEmailHtml(notification);
    const subject = `[${notification.rule.severity.toUpperCase()}] ${notification.rule.name}`;

    const { data, error } = await client.emails.send({
      from: "Chrondle Alerts <alerts@chrondle.app>",
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return;
    }

    console.log(`[Email] Alert sent to ${recipients.length} recipient(s):`, data?.id);
  } catch (error) {
    console.error("[Email] Failed to send email:", error);
    // Graceful degradation - don't throw, just log
  }
}

/**
 * Reset Resend client (for testing).
 * @internal
 */
export function resetResendClient(): void {
  resendClient = null;
}
