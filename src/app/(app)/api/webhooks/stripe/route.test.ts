import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

const actionMock = vi.fn();
const retrieveMock = vi.fn();
const getStripeMock = vi.fn();
const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders.value,
}));

vi.mock("@/lib/convexServer", () => ({
  api: { stripe: { webhookAction: { processWebhookEvent: "processWebhookEvent" } } },
  requireConvexClient: () => ({ action: actionMock }),
}));

vi.mock("@/lib/env", () => ({
  getEnvVar: (key: string) => process.env[key],
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => getStripeMock(),
}));

describe("/api/webhooks/stripe", () => {
  async function deliver(event: object) {
    const body = JSON.stringify(event);
    requestHeaders.value.set(
      "stripe-signature",
      Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: process.env.STRIPE_WEBHOOK_SECRET!,
      }),
    );
    const { POST } = await import("./route");
    return POST({ text: async () => body } as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SYNC_SECRET = "sync_secret";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    requestHeaders.value = new Headers();
    getStripeMock.mockImplementation(() => {
      throw new Error("No provider API credential in this webhook-only consumer");
    });
  });

  it.each([
    [
      "checkout.session.completed",
      { client_reference_id: "user_test", customer: "cus_test", subscription: null },
      {
        clerkId: "user_test",
        stripeCustomerId: "cus_test",
        subscriptionStatus: null,
        subscriptionPlan: null,
        subscriptionEndDate: null,
      },
    ],
    ["customer.subscription.deleted", { customer: "cus_test" }, { stripeCustomerId: "cus_test" }],
    [
      "invoice.payment_failed",
      { customer: "cus_test", billing_reason: "subscription_cycle" },
      { stripeCustomerId: "cus_test" },
    ],
    [
      "invoice.payment_succeeded",
      {
        customer: "cus_test",
        subscription: "sub_test",
        lines: { data: [{ period: { end: 222 } }] },
      },
      { stripeCustomerId: "cus_test", subscriptionEndDate: 222_000 },
    ],
  ])("verifies and forwards signed %s without an API credential", async (type, object, payload) => {
    const response = await deliver({
      id: "evt_signed",
      created: 1_700_000_000,
      type,
      data: { object },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(getStripeMock).not.toHaveBeenCalled();
    expect(actionMock).toHaveBeenCalledExactlyOnceWith("processWebhookEvent", {
      secret: "sync_secret",
      eventId: "evt_signed",
      eventTimestamp: 1_700_000_000,
      eventType: type,
      payload,
    });
  });

  it.each(["missing", "tampered", "expired"])(
    "rejects a %s signature before any provider or write",
    async (kind) => {
      const body = JSON.stringify({ id: "evt_denied", type: "customer.subscription.deleted" });
      if (kind !== "missing") {
        requestHeaders.value.set(
          "stripe-signature",
          Stripe.webhooks.generateTestHeaderString({
            payload: kind === "tampered" ? body + " " : body,
            secret: process.env.STRIPE_WEBHOOK_SECRET!,
            ...(kind === "expired" ? { timestamp: Math.floor(Date.now() / 1000) - 600 } : {}),
          }),
        );
      }
      const { POST } = await import("./route");
      const response = await POST({ text: async () => body } as any);
      expect(response.status).toBe(400);
      expect(getStripeMock).not.toHaveBeenCalled();
      expect(actionMock).not.toHaveBeenCalled();
    },
  );

  it("uses the current subscription state (retrieve) for subscription.updated", async () => {
    const event = {
      id: "evt_test",
      created: 1_700_000_000,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          metadata: { plan: "monthly" },
          current_period_end: 111,
          items: { data: [] },
        },
      },
    };

    getStripeMock.mockReturnValue({ subscriptions: { retrieve: retrieveMock } });

    retrieveMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      status: "past_due",
      metadata: { plan: "annual" },
      current_period_end: 222,
      items: { data: [] },
    });

    const response = await deliver(event);
    expect(await response.json()).toEqual({ received: true });

    expect(retrieveMock).toHaveBeenCalledWith("sub_123", { expand: ["items.data"] });
    expect(actionMock).toHaveBeenCalledWith("processWebhookEvent", {
      secret: "sync_secret",
      eventId: "evt_test",
      eventTimestamp: 1_700_000_000,
      eventType: "customer.subscription.updated",
      payload: {
        stripeCustomerId: "cus_123",
        subscriptionStatus: "past_due",
        subscriptionPlan: "annual",
        subscriptionEndDate: 222_000,
      },
    });
  });
});
