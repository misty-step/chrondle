"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setModePreferenceCookie, type ModeKey } from "@/lib/modePreference";
import { cn } from "@/lib/utils";

/**
 * Mode configuration with routes and display labels.
 * Adding new modes is trivial - just extend this record.
 */
const MODE_CONFIG: Record<
  ModeKey,
  {
    label: string;
    route: string;
  }
> = {
  classic: {
    label: "Classic",
    route: "/classic",
  },
  order: {
    label: "Order",
    route: "/order",
  },
};

interface ModeDropdownProps {
  className?: string;
}

/**
 * Editorial dropdown for game mode selection.
 *
 * **Deep Module Design:**
 * - Simple interface: Just renders with optional className
 * - Hides complexity: Route detection, navigation, cookie management all internal
 * - Scales infinitely: Adding modes requires only updating MODE_CONFIG
 *
 * **Aesthetic:**
 * - Warm archival styling matching Chrondle's historical theme
 * - Pill-shaped trigger with amber accent
 * - Card-like dropdown with warm shadows
 *
 * @example
 * <ModeDropdown className="ml-3" />
 */
export function ModeDropdown({ className }: ModeDropdownProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Derive current mode from pathname (information hiding - caller doesn't need to know)
  const currentMode: ModeKey = useMemo(() => {
    if (!pathname) return "classic";
    if (pathname.startsWith("/order")) return "order";
    return "classic";
  }, [pathname]);

  // Handle mode change - encapsulates routing and cookie logic
  const handleModeChange = (mode: string) => {
    const modeKey = mode as ModeKey;
    if (modeKey === currentMode) return;

    setModePreferenceCookie(modeKey);
    router.push(MODE_CONFIG[modeKey].route);
  };

  return (
    <Select value={currentMode} onValueChange={handleModeChange}>
      <SelectTrigger
        className={cn(
          // Override default height and shape
          "h-8 rounded-full",
          // Warm archival colors - override defaults
          "border-timeline-spine/30 bg-locked-badge-bg",
          "hover:bg-locked-badge-bg/80 hover:border-timeline-spine/50",
          // Typography - warm brown text
          "text-sm font-medium",
          // Enhanced shadow on hover
          "hover:shadow-md",
          // Custom focus ring - warm amber
          "focus-visible:ring-locked-badge/20",
          // Tighter padding for pill shape
          "px-3 py-1.5",
          // Custom styling for chevron icon color
          "[&_svg]:!text-timeline-marker [&_svg]:!opacity-60",
          // Cursor pointer for better affordance
          "cursor-pointer",
          className,
        )}
        style={{
          color: "var(--timeline-marker)",
        }}
        size="sm"
        aria-label="Select game mode"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent
        className={cn(
          // Card-like dropdown - override default rounded-md
          "rounded-xl",
          // Warm borders and shadows
          "border-timeline-spine/30 shadow-warm-lg",
          // Background
          "bg-card",
        )}
        position="popper"
        sideOffset={8}
      >
        {(Object.keys(MODE_CONFIG) as ModeKey[]).map((mode) => (
          <SelectItem
            key={mode}
            value={mode}
            className={cn(
              // Rounded items to match card aesthetic
              "rounded-lg",
              // Better padding
              "px-3 py-2",
              // Typography
              "text-sm",
              mode === currentMode && "font-semibold",
              // Hover state - warm amber highlight
              "hover:bg-locked-badge-bg focus:bg-locked-badge-bg",
            )}
            style={
              mode === currentMode
                ? { color: "var(--locked-badge)" }
                : { color: "var(--foreground)" }
            }
          >
            {MODE_CONFIG[mode].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
