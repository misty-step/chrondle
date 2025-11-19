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

const MODE_CONFIG: Record<
  ModeKey,
  {
    label: string;
    shortLabel: string;
    description: string;
    route: string;
  }
> = {
  classic: {
    label: "Classic · Guess the Year",
    shortLabel: "Classic",
    description: "Guess the exact year",
    route: "/classic",
  },
  order: {
    label: "Order · Arrange Events",
    shortLabel: "Order",
    description: "Arrange six events chronologically",
    route: "/order",
  },
};

interface ModeSwitcherProps {
  className?: string;
}

export function ModeSwitcher({ className }: ModeSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();

  const currentMode: ModeKey = useMemo(() => {
    if (!pathname) {
      return "classic";
    }
    if (pathname.startsWith("/order")) {
      return "order";
    }
    return "classic";
  }, [pathname]);

  const handleModeChange = (mode: ModeKey) => {
    if (mode === currentMode) {
      return;
    }

    setModePreferenceCookie(mode);
    router.push(MODE_CONFIG[mode].route);
  };

  return (
    <Select value={currentMode} onValueChange={(value) => handleModeChange(value as ModeKey)}>
      <SelectTrigger
        size="sm"
        aria-label="Switch game mode"
        className={["min-w-[140px]", className].filter(Boolean).join(" ")}
      >
        <SelectValue>
          <span className="hidden sm:inline">{MODE_CONFIG[currentMode].label}</span>
          <span className="sm:hidden">{MODE_CONFIG[currentMode].shortLabel}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(MODE_CONFIG).map(([key, config]) => (
          <SelectItem key={key} value={key}>
            <div className="flex flex-col">
              <span className="font-medium">{config.label}</span>
              <span className="text-muted-foreground text-xs">{config.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
