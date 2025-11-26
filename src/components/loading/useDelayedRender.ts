"use client";

import { useEffect, useState } from "react";

/**
 * Returns true after delayMs; used to avoid flashing loaders on ultra-short operations.
 */
export function useDelayedRender(delayMs: number) {
  const [ready, setReady] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const id = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  return ready;
}
