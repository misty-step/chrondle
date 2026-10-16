#!/usr/bin/env node
// Bounded migration audit: only these three Stripe GET resources are permitted.
// Stripe's v1 Events API has pending_webhooks, NOT endpoint HTTP delivery codes.
// Zero pending is not proof of a particular endpoint's 2xx delivery.
import { pathToFileURL } from "node:url";

const paths = new Set(["/v1/webhook_endpoints", "/v1/events", "/v1/subscriptions"]);
const eventTypes = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
];
const canonicalWebhook = "https://www.chrondle.app/api/webhooks/stripe";

export async function auditStripe({ key, prices, since = "0", fetchImpl = fetch, now = Date.now() }) {
  if (!/^sk_live_[A-Za-z0-9]+$/.test(key ?? "")) throw new Error("Existing live Stripe key required");
  if (prices.length !== 2 || prices.some((p) => !/^price_[A-Za-z0-9]+$/.test(p))) {
    throw new Error("Existing monthly and annual prices required");
  }
  const until = Math.floor(now / 1000);
  if (!/^\d+$/.test(since)) throw new Error("Invalid audit start");
  const start = since === "0" ? until - 86400 : Number(since);
  if (!Number.isSafeInteger(start) || start < until - 30 * 86400 || start > until) {
    throw new Error("Audit start must be within the last 30 days");
  }
  const deadline = now + 240000;
  const apiStatusCodes = [];
  async function list(path, params, prefix) {
    if (!paths.has(path)) throw new Error("Resource refused");
    let cursor;
    const records = new Map();
    for (let page = 0; page < 50; page++) {
      if (Date.now() > deadline) throw new Error("Audit deadline reached");
      const url = new URL(path, "https://api.stripe.com");
      url.search = new URLSearchParams({ limit: "100", ...params, ...(cursor ? { starting_after: cursor } : {}) });
      let response;
      try {
        response = await fetchImpl(url, {
          method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${key}` },
        });
      } catch { throw new Error("Stripe GET transport failure; raw error suppressed"); }
      apiStatusCodes.push(response.status);
      if (!response.ok) throw new Error(`Stripe GET refused (HTTP ${response.status}); raw body suppressed`);
      let body;
      try { body = await response.json(); } catch { throw new Error("Invalid Stripe list response"); }
      if (!Array.isArray(body.data) || typeof body.has_more !== "boolean") throw new Error("Invalid Stripe list response");
      for (const row of body.data) {
        if (typeof row.id !== "string" || !new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(row.id) || records.has(row.id)) {
          throw new Error("Invalid or duplicate Stripe identifier");
        }
        if (row.livemode !== true) throw new Error("Non-live Stripe record refused");
        records.set(row.id, row);
      }
      if (!body.has_more) return [...records.values()];
      if (!body.data.length) throw new Error("Incomplete Stripe pagination");
      cursor = body.data.at(-1).id;
    }
    throw new Error("Stripe pagination bound reached; no complete-total claim");
  }
  const endpoints = await list("/v1/webhook_endpoints", {}, "we");
  const canonical = endpoints.filter((e) => e.url === canonicalWebhook && e.status === "enabled");
  const covers = (e) => eventTypes.every((type) => e.enabled_events?.some((enabled) =>
    enabled === "*" || enabled === type || (enabled.endsWith(".*") && type.startsWith(enabled.slice(0, -1)))));
  const types = Object.fromEntries(eventTypes.map((type, i) => [`types[${i}]`, type]));
  const events = await list("/v1/events", { ...types, "created[gte]": String(start), "created[lte]": String(until) }, "evt");
  const subscriptions = {};
  for (const status of ["active", "trialing"]) {
    const ids = new Set();
    for (const price of new Set(prices)) {
      for (const row of await list("/v1/subscriptions", { status, price, "created[lte]": String(until) }, "sub")) {
        if (row.status !== status) throw new Error("Subscription status mismatch");
        ids.add(row.id);
      }
    }
    subscriptions[status] = [...ids].sort();
  }
  const pending = events.map((e) => {
    if (!Number.isSafeInteger(e.pending_webhooks) || e.pending_webhooks < 0) throw new Error("Invalid pending webhook count");
    return { event_id: e.id, count: e.pending_webhooks };
  }).sort((a, b) => a.event_id.localeCompare(b.event_id));
  // Explicit projection only. Never serialize upstream records, errors or keys.
  return {
    counts: { endpoints: endpoints.length, canonical_enabled_endpoints: canonical.length,
      canonical_endpoints_covering_handled_events: canonical.filter(covers).length,
      events: events.length, events_with_pending_webhooks: pending.filter((e) => e.count > 0).length,
      active_subscriptions: subscriptions.active.length, trialing_subscriptions: subscriptions.trialing.length },
    event_ids: pending.map((e) => e.event_id), pending_webhook_counts: pending,
    subscription_ids: subscriptions, api_status_codes: apiStatusCodes,
    delivery_status_codes: null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await auditStripe({ key: process.env.STRIPE_SECRET_KEY,
      prices: [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_ANNUAL],
      since: process.env.AUDIT_SINCE ?? "0" });
    console.log(JSON.stringify(report, null, 2));
    if (report.counts.canonical_enabled_endpoints !== 1 || report.counts.canonical_endpoints_covering_handled_events !== 1) {
      console.error("Canonical Stripe endpoint configuration failed; keep the existing writer");
      process.exitCode = 1;
    }
  } catch {
    // Upstream exceptions can contain private response bodies; do not echo them.
    console.error("Read-only Stripe audit failed; no complete audit or delivery proof");
    process.exitCode = 1;
  }
}
