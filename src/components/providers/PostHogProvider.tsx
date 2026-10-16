"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { captureProductEvent } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || previousPath.current === pathname) return;
    previousPath.current = pathname;
    captureProductEvent("$pageview");
  }, [pathname]);

  // Do not replace/remount the game tree when the SDK finishes loading.
  return children;
}
