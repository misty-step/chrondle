"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

// Lazy-loaded PostHog getter - matches PostHogProvider pattern
let posthogPromise: Promise<typeof import("posthog-js")> | null = null;

function getPostHog() {
  if (!posthogPromise) {
    posthogPromise = import("posthog-js");
  }
  return posthogPromise;
}

/**
 * Identifies the current user to PostHog for analytics.
 * Must be rendered inside both ClerkProvider and PostHogProvider.
 */
export function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    getPostHog().then(({ default: posthog }) => {
      if (user) {
        posthog.identify(user.id, {
          created_at: user.createdAt
            ? new Date(user.createdAt).toISOString()
            : undefined,
        });
      } else if (posthog._isIdentified?.()) {
        posthog.reset();
      }
    });
  }, [user, isLoaded]);

  return null;
}
