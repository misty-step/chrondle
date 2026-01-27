"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const enabled = Boolean(key);

  useEffect(() => {
    if (!key || typeof window === "undefined" || posthog.__loaded) {
      return;
    }

    posthog.init(key, {
      api_host: host || "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        blockSelector: "video, audio",
      },
    });
  }, [enabled, key, host]);

  if (!enabled) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
