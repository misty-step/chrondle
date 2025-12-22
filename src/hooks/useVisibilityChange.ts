"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * useVisibilityChange - Hook to detect when the tab becomes visible
 *
 * Deep Module: Hides browser visibility API complexity behind simple callback interface.
 *
 * Use Cases:
 * - Revalidate stale data when user returns to tab
 * - Pause/resume animations or timers
 * - Refresh authentication state
 *
 * @param onVisible - Callback fired when tab becomes visible
 * @param onHidden - Optional callback fired when tab becomes hidden
 *
 * @example
 * useVisibilityChange({
 *   onVisible: () => refetchPuzzle(),
 *   onHidden: () => pauseCountdown(),
 * });
 */
export interface UseVisibilityChangeOptions {
  /** Called when tab becomes visible */
  onVisible?: () => void;
  /** Called when tab becomes hidden */
  onHidden?: () => void;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

export function useVisibilityChange(options: UseVisibilityChangeOptions = {}): void {
  const { onVisible, onHidden, enabled = true } = options;

  // Use refs to avoid stale closures in the event handler
  const onVisibleRef = useRef(onVisible);
  const onHiddenRef = useRef(onHidden);

  // Keep refs updated
  useEffect(() => {
    onVisibleRef.current = onVisible;
    onHiddenRef.current = onHidden;
  }, [onVisible, onHidden]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible") {
      onVisibleRef.current?.();
    } else {
      onHiddenRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, handleVisibilityChange]);
}

/**
 * useOnTabFocus - Simplified hook that only fires on tab becoming visible
 *
 * @param callback - Function to call when tab becomes visible
 * @param enabled - Whether the hook is active (default: true)
 *
 * @example
 * useOnTabFocus(() => {
 *   // Revalidate data
 *   refetch();
 * });
 */
export function useOnTabFocus(callback: () => void, enabled: boolean = true): void {
  useVisibilityChange({
    onVisible: callback,
    enabled,
  });
}
