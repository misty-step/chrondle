"use client";

import { useState, useSyncExternalStore } from "react";
import { useHydrated } from "@/hooks/useClientSnapshot";

/**
 * Theme override hook (aesthetic mode semantics, recipes/mode.js)
 *
 * CSS handles system theme detection via media queries; the override is
 * persisted under the system's `ae-mode` key and booted before first
 * paint by the inline script in app/layout.tsx, so the page never
 * flashes the wrong mode.
 */

type ThemeOverride = "light" | "dark" | null;

interface UseSessionThemeReturn {
  override: ThemeOverride;
  systemTheme: "light" | "dark";
  currentTheme: "light" | "dark";
  toggle: () => void;
  isMounted: boolean;
}

// Helper function to detect system theme synchronously
function getInitialSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

// Read the persisted override (the same key the boot script reads)
function getInitialOverride(): ThemeOverride {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem("ae-mode");
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

function subscribeToSystemTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

export function useSessionTheme(): UseSessionThemeReturn {
  const [override, setOverride] = useState<ThemeOverride>(getInitialOverride);
  const systemTheme = useSyncExternalStore<"light" | "dark">(
    subscribeToSystemTheme,
    getInitialSystemTheme,
    () => "light" as const,
  );
  const isMounted = useHydrated();

  // Current resolved theme: override takes precedence, otherwise system
  const currentTheme = override || systemTheme;

  // Toggle: pin the opposite of the effective scheme and persist it
  const toggle = () => {
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setOverride(newTheme);
    try {
      localStorage.setItem("ae-mode", newTheme);
    } catch {
      // private mode: the override still applies for this session
    }
  };

  return {
    override,
    systemTheme,
    currentTheme,
    toggle,
    isMounted,
  };
}
