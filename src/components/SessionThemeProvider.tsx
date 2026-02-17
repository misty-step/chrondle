"use client";

import { createContext, useContext, useLayoutEffect } from "react";
import { useSessionTheme } from "@/hooks/useSessionTheme";

/**
 * Session Theme Provider - The Carmack Approach
 *
 * CSS handles system theme detection via media queries.
 * JavaScript only applies override classes for session-only user choices.
 *
 * No localStorage, no complex state management, no 3-state toggle.
 * Just applies .light or .dark class to html element when user overrides.
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

  // Apply theme classes before paint to prevent flash
  useLayoutEffect(() => {
    const html = document.documentElement;
    const targetTheme = sessionTheme.override ?? sessionTheme.systemTheme;
    const oppositeTheme = targetTheme === "dark" ? "light" : "dark";

    html.classList.remove(oppositeTheme);
    html.classList.add(targetTheme);
    html.classList.add("theme-loaded");
  }, [sessionTheme.override, sessionTheme.systemTheme]);

  const value: SessionThemeContextType = {
    ...sessionTheme,

    // Legacy compatibility - many components expect these
    darkMode: sessionTheme.currentTheme === "dark",
    toggleDarkMode: sessionTheme.toggle,
  };

  // Always render content - no more visibility hiding
  return <SessionThemeContext.Provider value={value}>{children}</SessionThemeContext.Provider>;
}

// Legacy compatibility export - existing components can keep using useTheme
export const useTheme = useSessionThemeContext;
