"use client";

import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Mode Filter - Game mode selection for admin queries
 *
 * Toggles between: All, Classic, Order
 * Persists selection in URL search params for deep linking.
 */

export type GameMode = "all" | "classic" | "order";

interface ModeOption {
  value: GameMode;
  label: string;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: "all", label: "All" },
  { value: "classic", label: "Classic" },
  { value: "order", label: "Order" },
];

interface ModeFilterProps {
  /** Optional callback when mode changes (in addition to URL update) */
  onChange?: (mode: GameMode) => void;
  /** Optional class name for the container */
  className?: string;
}

export function ModeFilter({ onChange, className }: ModeFilterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get current mode from URL, default to "all"
  const currentMode = (searchParams.get("mode") as GameMode) || "all";

  // Validate mode
  const isValidMode = MODE_OPTIONS.some((opt) => opt.value === currentMode);
  const activeMode = isValidMode ? currentMode : "all";

  const handleModeChange = (mode: GameMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      // Remove mode param for default (cleaner URL)
      params.delete("mode");
    } else {
      params.set("mode", mode);
    }
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);

    // Optional callback
    onChange?.(mode);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Game mode filter"
      className={cn("bg-surface-secondary inline-flex rounded-lg p-1", className)}
    >
      {MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={activeMode === option.value}
          onClick={() => handleModeChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:ring-accent-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            activeMode === option.value
              ? "bg-surface-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Hook to get current mode from URL search params.
 * Useful for components that need to read mode without rendering ModeFilter.
 */
export function useGameMode(): GameMode {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") as GameMode;
  return mode === "classic" || mode === "order" ? mode : "all";
}
