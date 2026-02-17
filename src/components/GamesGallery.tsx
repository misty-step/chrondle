"use client";

import { useCallback, type ElementType } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Crosshair, Shuffle } from "lucide-react";

import { setModePreferenceCookie, type ModeKey } from "@/lib/modePreference";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

// --- Configuration (co-located, not exported) ---

type ModeCardConfig = {
  key: ModeKey;
  title: string;
  description: string;
  route: string;
  badge?: string;
  icon: ElementType;
  cta: string;
};

const MODE_CARDS: ModeCardConfig[] = [
  {
    key: "classic",
    title: "Classic",
    description: "Pin the year from six historical clues.",
    route: "/classic",
    icon: Crosshair,
    cta: "Start Today's Classic",
  },
  {
    key: "order",
    title: "Order",
    description: "Drag six events into chronological order.",
    route: "/order",
    badge: "New",
    icon: Shuffle,
    cta: "Try Order Mode",
  },
];

const MODE_THEME = {
  classic: {
    card: "bg-mode-classic-bg text-mode-classic-text border-mode-classic-accent/30",
    accent: "text-mode-classic-accent",
  },
  order: {
    card: "bg-mode-order-bg text-mode-order-text border-mode-order-accent/30",
    accent: "text-mode-order-accent",
  },
} as const;

// --- Component ---

export function GamesGallery() {
  const router = useRouter();
  const classicPuzzle = useQuery(api.puzzles.getDailyPuzzle);
  const orderPuzzle = useQuery(api.orderPuzzles.getDailyOrderPuzzle);

  const handleSelect = useCallback(
    (mode: ModeKey, route: string) => {
      setModePreferenceCookie(mode);
      router.push(route);
    },
    [router],
  );

  const getPuzzleLabel = (modeKey: ModeKey) => {
    const puzzle = modeKey === "classic" ? classicPuzzle : orderPuzzle;
    return puzzle?.puzzleNumber ? `Puzzle #${puzzle.puzzleNumber}` : null;
  };

  return (
    <div className="bg-surface-primary flex min-h-dvh w-full items-center justify-center bg-[radial-gradient(circle,_#e5e5e5_1px,_transparent_1px)] bg-[size:20px_20px] p-4 md:p-8 dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.08)_1px,_transparent_1px)]">
      <main
        className={cn(
          "dark:border-border dark:bg-card border-border bg-surface-elevated flex w-full max-w-xl flex-col gap-5 rounded border p-5 md:gap-6 md:p-8",
          "text-card-foreground",
        )}
      >
        {/* Header: Wordmark + Tagline */}
        <header className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-5xl md:text-6xl">Chrondle</h1>
          <p className="text-muted-foreground font-body text-sm text-pretty md:text-base">
            Daily history puzzles
          </p>
        </header>

        {/* Mode Cards */}
        <div className="flex flex-col gap-3">
          {MODE_CARDS.map((mode) => {
            const theme = MODE_THEME[mode.key];
            const Icon = mode.icon;

            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => handleSelect(mode.key, mode.route)}
                className={cn(
                  "flex w-full flex-col gap-3 rounded border-2 p-4 text-left md:p-5",
                  "transition-transform duration-200 ease-out",
                  "hover:-translate-y-0.5",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  theme.card,
                )}
              >
                {/* Card Header: Icon + Title | Badge + Puzzle # */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5 shrink-0", theme.accent)} aria-hidden="true" />
                    <h2 className="font-heading text-xl font-semibold text-balance md:text-2xl">
                      {mode.title}
                    </h2>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {mode.badge && (
                      <span className="rounded border-2 border-current/25 px-2 py-0.5 text-[11px] font-semibold tracking-[0.1em] uppercase">
                        {mode.badge}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[11px] font-semibold tracking-[0.14em] uppercase tabular-nums",
                        "min-w-[5.5rem]",
                        theme.accent,
                      )}
                    >
                      {getPuzzleLabel(mode.key) ?? (
                        <span className="inline-block h-3 w-16 animate-pulse rounded bg-current/20" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="font-body text-sm leading-snug text-pretty md:text-[15px]">
                  {mode.description}
                </p>

                {/* CTA */}
                <div className="mt-auto pt-1">
                  <span
                    className={cn(
                      "inline-flex min-h-12 w-full items-center justify-center rounded border-2 border-current/30 px-6 py-3 text-base font-semibold",
                      "transition-colors duration-200 ease-out hover:bg-current/10",
                      theme.accent,
                    )}
                  >
                    {mode.cta}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
