import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "posthog-js";
import { analyticsRoute, sanitizeAnalyticsEvent, chrondlePostHogConfig } from "../posthog";

const id = "0199a8b7-1234-4567-89ab-123456789abc";
function event(name = "guess_submitted"): CaptureResult {
  return {
    event: name,
    uuid: id,
    timestamp: new Date(),
    properties: {
      distinct_id: id,
      $session_id: id,
      $device_id: id,
      $window_id: id,
      $current_url: "https://www.chrondle.app/?email=privatecanary@example.test",
      $referrer: "https://privatecanary.example.test/",
      $ip: "203.0.113.10",
      $user_agent: "privatecanary",
      email: "privatecanary@example.test",
      user_id: "privatecanary",
      targetYear: 1969,
      start: 1900,
      end: 2000,
      clue: "privatecanary",
      mode: "classic",
      guessCount: 1,
      won: true,
    },
    $set_once: { $initial_referrer: "privatecanary" },
  };
}

describe("privacy-safe official SDK transport", () => {
  beforeEach(() => window.history.replaceState({}, "", "/classic?privatecanary=1#privatecanary"));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    "$pageview",
    "game_loaded",
    "hint_viewed",
    "guess_submitted",
    "game_completed",
    "reminder_optin",
  ])("allows only the %s contract", (name) => {
    const safe = sanitizeAnalyticsEvent(event(name));
    expect(safe).not.toBeNull();
    expect(safe?.properties).toMatchObject({
      app: "chrondle",
      route: "/classic",
      $ip: "0.0.0.0",
      $geoip_disable: true,
      is_synthetic: true,
    });
    expect(JSON.stringify(safe)).not.toContain("privatecanary");
    expect(safe?.properties).not.toHaveProperty("targetYear");
    expect(safe?.properties).not.toHaveProperty("start");
    expect(safe).not.toHaveProperty("$set_once");
  });

  it.each(["$autocapture", "$identify", "$snapshot", "exception", "state_divergence"])(
    "drops %s",
    (name) => {
      expect(sanitizeAnalyticsEvent(event(name))).toBeNull();
    },
  );

  it("rejects identified users and invalid bounded values", () => {
    const input = event();
    input.properties.distinct_id = "private-account";
    expect(sanitizeAnalyticsEvent(input)).toBeNull();
    input.properties.distinct_id = id;
    input.properties.guessCount = 9999;
    input.properties.mode = "privatecanary";
    expect(sanitizeAnalyticsEvent(input)?.properties).not.toHaveProperty("guessCount");
    expect(sanitizeAnalyticsEvent(input)?.properties).not.toHaveProperty("mode");
  });

  it.each([
    ["/archive/puzzle/privatecanary", "/archive/puzzle/:id"],
    ["/duel/privatecanary", "/other"],
    ["/settings", "/settings"],
  ])("templates %s", (path, expected) => {
    expect(analyticsRoute(path)).toBe(expected);
  });

  it("disables automatic capture, profiles, recording and cross-host identity", () => {
    expect(chrondlePostHogConfig).toMatchObject({
      person_profiles: "never",
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      respect_dnt: true,
      cross_subdomain_cookie: false,
      cookie_expiration: 30,
    });
  });

  it("initializes once before early capture, contains SDK failure and retries later", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "public-test-fixture");
    const capture = vi.fn().mockImplementationOnce(() => {
      throw new Error("sink unavailable");
    });
    const init = vi.fn();
    vi.doMock("posthog-js", () => ({ default: { init, capture } }));
    const { captureProductEvent } = await import("../posthog");
    expect(() => captureProductEvent("game_loaded")).not.toThrow();
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    captureProductEvent("hint_viewed", { hintNumber: 1 });
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    expect(init).toHaveBeenCalledTimes(2);
    captureProductEvent("reminder_optin");
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(3));
    expect(init).toHaveBeenCalledTimes(2);
  });
});
