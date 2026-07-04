#!/usr/bin/env node
/**
 * Stripe Webhook Redirect Guard
 *
 * Stripe does not follow HTTP redirects when delivering webhooks (see
 * INCIDENT-2026-01-17T.md: a 307 from chrondle.app -> www.chrondle.app
 * silently dropped every webhook for ~30 minutes). This script requests the
 * production webhook route directly, without following redirects, and fails
 * if the response is a 3xx.
 *
 * A non-redirect response (2xx/4xx) is healthy: Stripe's real POSTs carry a
 * signature this route will reject with 4xx, which is exactly what a
 * reachable, non-redirecting endpoint looks like from the outside. The only
 * failure mode this script exists to catch is a 3xx, because that's the one
 * Stripe cannot recover from.
 *
 * Usage:
 *   node scripts/verify-webhook-redirect.mjs [url]
 *
 * Environment:
 *   WEBHOOK_URL   Overrides the URL to check (default below)
 *
 * Exit codes:
 *   0 = no redirect observed
 *   1 = redirect observed, or request could not be made
 */

const DEFAULT_URL = "https://www.chrondle.app/api/webhooks/stripe";

async function main() {
  const url = process.argv[2] || process.env.WEBHOOK_URL || DEFAULT_URL;

  console.log(`Checking webhook route for redirects: ${url}`);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch (error) {
    console.error(`FAIL: request to ${url} did not complete: ${error.message}`);
    process.exit(1);
  }

  const { status } = response;

  if (status >= 300 && status < 400) {
    const location = response.headers.get("location") || "(no Location header)";
    console.error(
      `FAIL: ${url} returned ${status} (redirect to ${location}).\n` +
        "Stripe does not follow redirects for webhook delivery — this endpoint " +
        "would silently drop every webhook event (see INCIDENT-2026-01-17T.md).",
    );
    process.exit(1);
  }

  console.log(`OK: ${url} returned ${status} (no redirect)`);
  process.exit(0);
}

main();
