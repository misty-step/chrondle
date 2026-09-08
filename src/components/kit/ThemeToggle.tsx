"use client";

import React from "react";
import { Sun, Moon } from "@/components/kit/icons";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/SessionThemeProvider";
import { playSound } from "@/lib/sound/soundEngine";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", size = "md" }) => {
  const { currentTheme, override, systemTheme, toggle } = useTheme();
  const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 18;
  const tooltip = override
    ? `Theme: ${currentTheme} (overriding system ${systemTheme})`
    : `Theme: ${currentTheme} (following system)`;

  return (
    <button
      type="button"
      onClick={() => {
        toggle();
        playSound("toggle", { variant: currentTheme === "dark" ? "high" : "low" });
      }}
      aria-label={currentTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={tooltip}
      className={cn(
        size === "lg" ? "h-12 w-12" : "h-11 w-11",
        "flex shrink-0 cursor-pointer items-center justify-center rounded-lg",
        "text-muted-foreground hover:text-foreground hover:bg-surface-elevated",
        "transition-colors duration-150 motion-reduce:transition-none",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      {currentTheme === "dark" ? (
        <Moon size={iconSize} weight="bold" aria-hidden="true" />
      ) : (
        <Sun size={iconSize} weight="bold" aria-hidden="true" />
      )}
    </button>
  );
};
