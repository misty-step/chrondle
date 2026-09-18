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
import { MODES, MODE_ORDER } from "@/lib/modes";
import { playSound } from "@/lib/sound/soundEngine";
import { cn } from "@/lib/utils";

interface ModeDropdownProps {
  className?: string;
}

/** Mode selection shares the gallery's route and preference-cookie contract. */
export function ModeDropdown({ className }: ModeDropdownProps) {
  const pathname = usePathname();
  const router = useRouter();

  const currentMode: ModeKey = useMemo(() => {
    for (const key of MODE_ORDER) {
      if (pathname.startsWith(MODES[key].route)) {
        return key;
      }
    }
    return "classic";
  }, [pathname]);

  const handleModeChange = (mode: string) => {
    const modeKey = mode as ModeKey;
    if (modeKey === currentMode) return;

    playSound("whoosh", { volume: 0.3 });
    setModePreferenceCookie(modeKey);
    router.push(MODES[modeKey].route);
  };

  return (
    <Select value={currentMode} onValueChange={handleModeChange}>
      <SelectTrigger
        className={cn(
          "border-border bg-background min-h-11 rounded-lg px-3 text-sm font-semibold shadow-none",
          "text-foreground hover:bg-surface-inset dark:bg-background dark:hover:bg-surface-inset",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
          "cursor-pointer transition-colors duration-150",
          className,
        )}
        aria-label="Select game mode"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent
        className="bg-surface-elevated border-border shadow-elevation-2 min-w-40 rounded-xl border p-1"
        position="popper"
        sideOffset={8}
      >
        {MODE_ORDER.map((mode) => (
          <SelectItem
            key={mode}
            value={mode}
            className={cn(
              "focus:bg-surface-inset focus:text-foreground min-h-11 cursor-pointer rounded-lg py-2 pr-9 pl-3 text-sm font-medium transition-colors",
              mode === currentMode
                ? "bg-feedback-success/10 text-feedback-success"
                : "text-foreground",
            )}
          >
            {MODES[mode].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
