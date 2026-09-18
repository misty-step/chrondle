"use client";

import React from "react";
import Link from "next/link";
import { Check } from "@/components/kit/icons";

import { MODES, MODE_ORDER } from "@/lib/modes";
import { setModePreferenceCookie, type ModeKey } from "@/lib/modePreference";
import { useTodayModeStatus } from "@/hooks/useTodayModeStatus";
import type { ModeTodayStatus } from "@/lib/todayModeStatus";
import { cn } from "@/lib/utils";

interface KeepPlayingProps {
  /** Mode the player just finished — excluded from suggestions */
  currentMode: ModeKey;
  className?: string;
}

function StatusBadge({ status }: { status: ModeTodayStatus }) {
  if (status === "unknown") {
    return null;
  }

  if (status === "done") {
    return (
      <span className="text-feedback-success flex shrink-0 items-center gap-1 text-xs font-semibold">
        <Check className="size-3.5" aria-hidden="true" />
        Done today
      </span>
    );
  }

  return (
    <span className="shrink-0 text-xs font-semibold opacity-80">
      {status === "endless" ? "Endless" : "Not played today"}
    </span>
  );
}

/**
 * Cross-mode promotion shown on completion screens — today's checklist
 * (design-lab winner C3).
 *
 * The daily puzzles are over in minutes; this strip is how a finished player
 * discovers there is more Chrondle today. Each daily mode carries live
 * done/todo state for the player's local "today", so the strip reads as a
 * checklist rather than ads.
 */
export function KeepPlaying({ currentMode, className }: KeepPlayingProps) {
  const suggestions = MODE_ORDER.filter((key) => key !== currentMode).map((key) => MODES[key]);
  const statuses = useTodayModeStatus();

  return (
    <section className={cn("space-y-3", className)} aria-label="Play another mode">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Keep playing — today
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {suggestions.map((mode) => {
          const Icon = mode.icon;
          const status = statuses[mode.key];
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
                status === "done" && "opacity-70",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", mode.accentClass)} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm leading-tight font-semibold">{mode.label}</span>
                <span className="truncate text-xs leading-tight opacity-80">{mode.tagline}</span>
              </span>
              <StatusBadge status={status} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
