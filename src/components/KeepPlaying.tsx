"use client";

import React from "react";
import Link from "next/link";

import { MODES, MODE_ORDER } from "@/lib/modes";
import { setModePreferenceCookie, type ModeKey } from "@/lib/modePreference";
import { cn } from "@/lib/utils";

interface KeepPlayingProps {
  /** Mode the player just finished — excluded from suggestions */
  currentMode: ModeKey;
  className?: string;
}

/**
 * Cross-mode promotion shown on completion screens.
 *
 * The daily puzzles are over in minutes; this strip is how a finished player
 * discovers there is more Chrondle today. Kept compact on purpose — three
 * thumb-sized chips, no copy beyond a tagline.
 */
export function KeepPlaying({ currentMode, className }: KeepPlayingProps) {
  const suggestions = MODE_ORDER.filter((key) => key !== currentMode).map((key) => MODES[key]);

  return (
    <section className={cn("space-y-3", className)} aria-label="Play another mode">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Keep playing
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {suggestions.map((mode) => {
          const Icon = mode.icon;
          return (
            <Link
              key={mode.key}
              href={mode.route}
              onClick={() => setModePreferenceCookie(mode.key)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded border-2 px-3 py-2.5",
                "transition-transform duration-200 ease-out hover:-translate-y-0.5",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                mode.cardClass,
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", mode.accentClass)} aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm leading-tight font-semibold">{mode.label}</span>
                <span className="truncate text-xs leading-tight opacity-80">{mode.tagline}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
