"use client";

import { useEffect, useState, type ReactNode } from "react";

// Lazy-loaded PostHog instance - not imported at module level to reduce initial bundle
let posthogPromise: Promise<typeof import("posthog-js")> | null = null;

function getPostHog() {
  if (!posthogPromise) {
    posthogPromise = import("posthog-js");
  }
  return posthogPromise;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!key || typeof window === "undefined") {
      return;
    }

    // Lazy load PostHog after initial render
    getPostHog().then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: host || "/ingest",
          ui_host: "https://us.posthog.com",
          person_profiles: "identified_only",
          capture_pageview: true,
          capture_pageleave: true,
          respect_dnt: true,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: "*",
            blockSelector: "video, audio",
          },
        });
      }
      setIsLoaded(true);
    });
  }, [key, host]);

  // Always render children immediately - PostHog loads async
  // PHProvider is only needed for React hooks, not basic capture
  if (!isLoaded) {
    return <>{children}</>;
  }

  // Dynamically import the provider only when needed
  return <LazyPHProvider>{children}</LazyPHProvider>;
}

// Separate component to avoid importing posthog-js/react at module level
function LazyPHProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<React.ComponentType<{
    client: typeof import("posthog-js").default;
    children: ReactNode;
  }> | null>(null);
  const [client, setClient] = useState<typeof import("posthog-js").default | null>(null);

  useEffect(() => {
    Promise.all([
      import("posthog-js/react").then((m) => m.PostHogProvider),
      getPostHog().then((m) => m.default),
    ]).then(([PHProvider, posthog]) => {
      setProvider(() => PHProvider);
      setClient(posthog);
    });
  }, []);

  if (!Provider || !client) {
    return <>{children}</>;
  }

  return <Provider client={client}>{children}</Provider>;
}
