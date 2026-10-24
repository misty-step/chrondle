"use client";

import { useEffect, useState } from "react";

/**
 * Returns true once `isLoading` has stayed true for `timeoutMs`.
 * Resets as soon as loading ends, so a late response clears the timeout.
 */
export function useLoadTimeout(isLoading: boolean, timeoutMs: number): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;

    const timeoutId = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => {
      window.clearTimeout(timeoutId);
      setTimedOut(false);
    };
  }, [isLoading, timeoutMs]);

  return isLoading && timedOut;
}
