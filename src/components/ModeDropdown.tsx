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
    if (pathname.startsWith("/order") || pathname.startsWith("/archive/order")) return "order";
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
          // Override default height and shape - archival angular aesthetic
          "h-8 rounded-sm",
          // Solid, confident colors - no translucency
          "bg-surface-elevated border-outline-default border-2",
          "hover:border-primary/50 hover:shadow-hard-sm",
          // Typography - clear, readable (theme-adaptive)
          "text-foreground text-sm font-semibold",
          // Custom focus ring
          "focus-visible:ring-primary/20",
          // Padding for archival badge
          "px-3 py-1.5",
          // Cursor pointer for better affordance
          "cursor-pointer",
          className,
        )}
        size="sm"
        aria-label="Select game mode"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent
        className={cn(
          // Archival dropdown - consistent with trigger
          "rounded-sm",
          // Solid borders and shadows
          "border-outline-default shadow-hard border-2",
          // Background
          "bg-surface-elevated",
        )}
        position="popper"
        sideOffset={8}
      >
        {(Object.keys(MODE_CONFIG) as ModeKey[]).map((mode) => (
          <SelectItem
            key={mode}
            value={mode}
            className={cn(
              // Archival items - consistent angular aesthetic
              "rounded-sm",
              // Better padding
              "px-3 py-2",
              // Typography (theme-adaptive)
              "text-foreground text-sm",
              mode === currentMode && "font-semibold",
              // Hover state - clear highlight
              "hover:bg-muted focus:bg-muted",
            )}
          >
            {MODE_CONFIG[mode].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
