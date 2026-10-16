import type { BeforeSendFn, PostHogConfig } from "posthog-js";

const storyEvents = new Set([
  "$pageview",
  "game_loaded",
  "hint_viewed",
  "guess_submitted",
  "game_completed",
  "reminder_optin",
]);
const anonymousId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function analyticsRoute(path: string): string {
  if (/^\/archive\/puzzle\/[^/]+\/?$/.test(path)) return "/archive/puzzle/:id";
  return [
    "/",
    "/classic",
    "/order",
    "/duel",
    "/archive",
    "/settings",
    "/pricing",
    "/changelog",
  ].includes(path)
    ? path
    : "/other";
}

// Rebuild the envelope as well: SDK $set_once can otherwise carry referrer PII.
export const sanitizeAnalyticsEvent: BeforeSendFn = (event) => {
  if (!event || !storyEvents.has(event.event)) return null;
  const input = event.properties;
  if (!anonymousId.test(input.distinct_id ?? "")) return null;
  const route = analyticsRoute(window.location.pathname);
  const production = process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT === "production";
  const properties: typeof input = {
    token: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    app: "chrondle",
    environment: production ? "production" : "development",
    release: process.env.CHRONDLE_REVISION ?? "unknown",
    is_synthetic: !production || navigator.webdriver === true || input.$browser_type === "bot",
    distinct_id: input.distinct_id,
    $process_person_profile: false,
    $geoip_disable: true,
    // Null is replaced by the transport's IP at ingestion. A sentinel is not.
    $ip: "0.0.0.0",
    route,
    $host: "www.chrondle.app",
    $pathname: route,
    $current_url: `https://www.chrondle.app${route}`,
  };
  for (const key of ["$device_id", "$session_id", "$window_id"]) {
    if (anonymousId.test(input[key] ?? "")) properties[key] = input[key];
  }
  for (const key of ["hintNumber", "guessCount"]) {
    if (Number.isSafeInteger(input[key]) && input[key] >= 0 && input[key] <= 6) {
      properties[key] = input[key];
    }
  }
  if (typeof input.won === "boolean") properties.won = input.won;
  if (["classic", "order", "duel"].includes(input.mode)) properties.mode = input.mode;
  return { uuid: event.uuid, event: event.event, timestamp: event.timestamp, properties };
};

export const chrondlePostHogConfig: Partial<PostHogConfig> = {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  person_profiles: "never",
  persistence_name: "chrondle-anonymous-v1",
  cross_subdomain_cookie: false,
  cookie_expiration: 30,
  capture_pageview: false,
  capture_pageleave: false,
  autocapture: false,
  rageclick: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_performance: false,
  capture_heatmaps: false,
  disable_session_recording: true,
  disable_surveys: true,
  advanced_disable_flags: true,
  advanced_disable_toolbar_metrics: true,
  save_referrer: false,
  store_google: false,
  ip: false,
  respect_dnt: true,
  opt_out_useragent_filter: true,
  before_send: sanitizeAnalyticsEvent,
};

let clientPromise: Promise<typeof import("posthog-js").default> | undefined;

export function captureProductEvent(event: string, properties?: Record<string, unknown>): void {
  if (
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    !storyEvents.has(event)
  )
    return;
  // One SDK/identity/queue, initialized before capture even if child effects run first.
  clientPromise ??= import("posthog-js").then(({ default: client }) => {
    client.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, chrondlePostHogConfig);
    return client;
  });
  void clientPromise
    .then((client) => client.capture(event, properties))
    .catch(() => {
      // A failed import/init/capture is not a failed game. A later event may retry.
      clientPromise = undefined;
    });
}
