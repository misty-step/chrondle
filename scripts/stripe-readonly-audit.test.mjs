import assert from "node:assert/strict";
import { test } from "node:test";
import { auditStripe } from "./stripe-readonly-audit.mjs";

const key = "sk_live_SyntheticAuditOnly";

const canary = "private-name-email-card-and-key-canary";
const endpoint = { id: "we_Canonical", livemode: true,
  url: "https://www.chrondle.app/api/webhooks/stripe", status: "enabled", enabled_events: ["*"] };
function transport(transform = (rows) => rows) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url.origin, "https://api.stripe.com");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    assert.ok(options.signal instanceof AbortSignal);
    calls.push(String(url));
    let rows;
    if (url.pathname === "/v1/webhook_endpoints") rows = [endpoint];
    else if (url.pathname === "/v1/events") rows = [{ id: "evt_One", livemode: true, pending_webhooks: 0 }];
    else {
      assert.equal(url.pathname, "/v1/subscriptions");
      assert.equal(url.searchParams.has("price"), false);
      const status = url.searchParams.get("status");
      rows = [{ id: `sub_${status}`, livemode: true, status }];
    }
    return Response.json(transform(rows.map((r) => ({ ...r, email: canary, customer: canary,
      data: { object: { payment_details: canary } }, secret: canary })), url));
  };
  return { fetchImpl, calls };
}
const run = (fetchImpl, extra = {}) => auditStripe({ key, fetchImpl, ...extra });

test("all calls are bounded fixed-origin GETs; output only projects counts/IDs and never invents delivery codes", async () => {
  const { fetchImpl, calls } = transport((data) => ({ data, has_more: false }));
  const report = await run(fetchImpl);
  assert.equal(calls.length, 4);
  const eventRequest = new URL(calls.find((url) => new URL(url).pathname === "/v1/events"));
  const requestedTypes = [...eventRequest.searchParams.entries()].filter(([key]) => key.startsWith("types[")).map(([, value]) => value);
  assert.ok(requestedTypes.includes("invoice.payment_succeeded"));
  assert.ok(requestedTypes.includes("invoice.payment_failed"));
  assert.ok(!requestedTypes.includes("invoice.paid"));
  assert.equal(report.counts.active_subscriptions, 1);
  assert.deepEqual(report.subscription_ids.active, ["sub_active"]);
  assert.equal(report.counts.events, 1);
  assert.equal(report.counts.canonical_endpoints_covering_handled_events, 1);
  assert.equal(report.delivery_status_codes, null);
  assert.ok(!JSON.stringify(report).includes(canary));
  assert.ok(!JSON.stringify(report).includes(key));
});

test("paginates before declaring complete totals and forwards the exact cursor", async () => {
  const { fetchImpl, calls } = transport((data, url) => {
    if (url.pathname !== "/v1/events") return { data, has_more: false };
    if (url.searchParams.has("starting_after")) {
      assert.equal(url.searchParams.get("starting_after"), "evt_One");
      return { data: [{ id: "evt_Two", livemode: true, pending_webhooks: 1 }], has_more: false };
    }
    return { data, has_more: true };
  });
  const result = await run(fetchImpl);
  assert.equal(calls.length, 5);
  assert.equal(result.counts.events, 2);
  assert.equal(result.counts.events_with_pending_webhooks, 1);
});

for (const [name, body] of [
  ["malformed list", {}], ["incomplete page", { data: [], has_more: true }],
  ["invalid identifier", { data: [{ ...endpoint, id: canary }], has_more: false }],
  ["test-mode row", { data: [{ ...endpoint, livemode: false }], has_more: false }],
]) {
  test(`refuses ${name} rather than returning plausible totals`, async () => {
    await assert.rejects(run(async () => Response.json(body)));
  });
}

test("refuses duplicate pages, exhausted pagination, wrong status and invalid pending count", async () => {
  await assert.rejects(run(transport((data) => ({ data, has_more: true })).fetchImpl), /duplicate/);
  let page = 0;
  await assert.rejects(run(async () => Response.json({ data: [{ ...endpoint, id: `we_Page${page++}` }], has_more: true })), /bound/);
  await assert.rejects(run(transport((data, url) => ({ data: url.pathname === "/v1/subscriptions" ? data.map((r) => ({ ...r, status: "canceled" })) : data, has_more: false })).fetchImpl), /status mismatch/);
  await assert.rejects(run(transport((data, url) => ({ data: url.pathname === "/v1/events" ? data.map((r) => ({ ...r, pending_webhooks: undefined })) : data, has_more: false })).fetchImpl), /pending webhook/);
});

test("raw errors, redirect bodies and malformed JSON never reach the error message", async () => {
  for (const fetchImpl of [
    async () => { throw new Error(canary); },
    async () => new Response(canary, { status: 302 }),
    async () => new Response(canary, { status: 403 }),
    async () => new Response(canary),
  ]) {
    await assert.rejects(run(fetchImpl), (error) => !error.message.includes(canary));
  }
});

test("invalid key and window fail before any provider call", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error("must not run"); };
  for (const extra of [{ key: "sk_test_NotLive" }, { since: "-1" }, { since: "1" }, { since: "99999999999999" }]) {
    await assert.rejects(run(fetchImpl, extra));
  }
  assert.equal(calls, 0);
});
