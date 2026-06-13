"use client";

import React from "react";
import { Sun, Moon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/SessionThemeProvider";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * The mode toggle (aesthetic .ae-mode costume): an icon button where
 * sun and moon rotate-crossfade. The crossfade is driven entirely by
 * the root .dark/.light class in CSS, so both icons always render and
 * hydration never mismatches.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { currentTheme, override, systemTheme, toggle } = useTheme();

  // Tooltip shows current state and provenance
  const getTooltip = () => {
    if (override) {
      return `Theme: ${currentTheme} (overriding system ${systemTheme})`;
    }
    return `Theme: ${currentTheme} (following system)`;
  };

  return (
    <button
      onClick={toggle}
      className={cn("ae-mode", className)}
      aria-label="Toggle light or dark mode"
      title={getTooltip()}
      type="button"
    >
      <Sun className="ae-icon is-fill ae-sun" aria-hidden="true" />
      <Moon className="ae-icon is-fill ae-moon" aria-hidden="true" />
    </button>
  );
};
