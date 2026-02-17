import { describe, it, expect, vi, beforeEach } from "vitest";

const actionMock = vi.fn();
const retrieveMock = vi.fn();
const constructEventMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "stripe-signature": "sig" }),
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
  getStripe: () => ({
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: retrieveMock },
  }),
}));

describe("/api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SYNC_SECRET = "sync_secret";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

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

    constructEventMock.mockReturnValue(event);

    retrieveMock.mockResolvedValue({
      id: "sub_123",
      customer: "cus_123",
      status: "past_due",
      metadata: { plan: "annual" },
      current_period_end: 222,
      items: { data: [] },
    });

    const { POST } = await import("./route");
    await POST({ text: async () => "body" } as any);

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
