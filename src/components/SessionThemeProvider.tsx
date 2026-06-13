"use client";

import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { useSessionTheme } from "@/hooks/useSessionTheme";

/**
 * Session Theme Provider (aesthetic mode semantics)
 *
 * CSS handles system theme detection via media queries. JavaScript pins
 * `.light` / `.dark` on the root (plus `color-scheme`, so UA widgets
 * follow the pinned side) when the user overrides.
 *
 * The change itself is the locked choreography from recipes/mode.js:
 * one soft 700ms view-transition breath, a 480ms uniform color ease
 * where unsupported, instant under reduced motion.
 */

interface SessionThemeContextType {
  override: "light" | "dark" | null;
  systemTheme: "light" | "dark";
  currentTheme: "light" | "dark";
  toggle: () => void;
  isMounted: boolean;

  // Legacy compatibility for existing components
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const SessionThemeContext = createContext<SessionThemeContextType | undefined>(undefined);

export function useSessionThemeContext() {
  const context = useContext(SessionThemeContext);
  if (context === undefined) {
    throw new Error("useSessionThemeContext must be used within a SessionThemeProvider");
  }
  return context;
}

interface SessionThemeProviderProps {
  children: React.ReactNode;
}

export function SessionThemeProvider({ children }: SessionThemeProviderProps) {
  const sessionTheme = useSessionTheme();
  const hasPaintedRef = useRef(false);

  // Apply theme classes before paint; breathe only on real changes
  useLayoutEffect(() => {
    const html = document.documentElement;
    const targetTheme = sessionTheme.override ?? sessionTheme.systemTheme;
    const oppositeTheme = targetTheme === "dark" ? "light" : "dark";

    const flip = () => {
      html.classList.remove(oppositeTheme);
      html.classList.add(targetTheme);
      html.style.colorScheme = targetTheme;
      html.classList.add("theme-loaded");
    };

    if (html.classList.contains(targetTheme)) {
      flip(); // already pinned (boot script or repeat render): no breath
      hasPaintedRef.current = true;
      return;
    }

    const firstPaint = !hasPaintedRef.current;
    hasPaintedRef.current = true;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (firstPaint || reducedMotion) {
      flip();
    } else if (document.startViewTransition) {
      html.classList.add("ae-vt-mode");
      document
        .startViewTransition(flip)
        .finished.finally(() => html.classList.remove("ae-vt-mode"));
    } else {
      html.classList.add("ae-mode-easing");
      flip();
      setTimeout(() => html.classList.remove("ae-mode-easing"), 520);
    }
  }, [sessionTheme.override, sessionTheme.systemTheme]);

  const value: SessionThemeContextType = {
    ...sessionTheme,

    // Legacy compatibility - many components expect these
    darkMode: sessionTheme.currentTheme === "dark",
    toggleDarkMode: sessionTheme.toggle,
  };

  return <SessionThemeContext.Provider value={value}>{children}</SessionThemeContext.Provider>;
}

// Legacy compatibility export - existing components can keep using useTheme
export const useTheme = useSessionThemeContext;
