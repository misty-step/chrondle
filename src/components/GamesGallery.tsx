"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useTodaysPuzzle } from "@/hooks/useTodaysPuzzle";
import { useTodaysOrderPuzzle } from "@/hooks/useTodaysOrderPuzzle";
import { setModePreferenceCookie, type ModeKey } from "@/lib/modePreference";
import { MODES } from "@/lib/modes";
import { siteConfig } from "@/lib/site";
import { playSound } from "@/lib/sound/soundEngine";
import { cn } from "@/lib/utils";

// Mode identity lives in the shared registry; the gallery owns its instructions.

type ModeCardConfig = {
  key: ModeKey;
  description: string;
};
const MODE_CARDS: ModeCardConfig[] = [
  {
    key: "classic",
    description: "Pin the year from six historical clues.",
  },
  {
    key: "order",
    description: "Arrange six events in chronological order.",
  },
  {
    key: "duel",
    description: "Two events. Tap the one that happened first. How long can you last?",
  },
];

export function GamesGallery() {
  const router = useRouter();
  const { puzzle: classicPuzzle } = useTodaysPuzzle();
  const { puzzle: orderPuzzle } = useTodaysOrderPuzzle();

  const handleSelect = useCallback(
    (mode: ModeKey, route: string) => {
      playSound("whoosh", { volume: 0.3 });
      setModePreferenceCookie(mode);
      router.push(route);
    },
    [router],
  );

  const getPuzzleLabel = (modeKey: ModeKey) => {
    if (modeKey === "duel") {
      return "Endless";
    }

    const puzzle = modeKey === "classic" ? classicPuzzle : orderPuzzle;
    return puzzle?.puzzleNumber ? `Puzzle #${puzzle.puzzleNumber}` : null;
  };

  return (
    <div className="bg-surface-primary flex min-h-dvh w-full items-center px-4 py-12 sm:px-6 sm:py-16">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="flex flex-col gap-4 text-center">
          <h1 className="font-display text-foreground text-5xl font-semibold sm:text-6xl">
            Chrondle
          </h1>
          <p className="text-muted-foreground font-body mx-auto max-w-md text-base leading-relaxed text-pretty">
            {siteConfig.description}
          </p>
        </header>

        <section aria-label="Choose a game" className="flex flex-col gap-3">
          {MODE_CARDS.map((mode) => {
            const info = MODES[mode.key];
            const Icon = info.icon;

            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => handleSelect(mode.key, info.route)}
                aria-label={`Play ${info.label}`}
                aria-describedby={`${mode.key}-description ${mode.key}-puzzle`}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border p-4 text-left sm:gap-4 sm:p-5",
                  "hover:border-foreground/30 transition-colors duration-150",
                  "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  info.cardClass,
                )}
              >
                <Icon
                  className={cn("mt-1 h-6 w-6 shrink-0", info.accentClass)}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col gap-2">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-display text-foreground text-xl font-semibold sm:text-2xl">
                      {info.label}
                    </span>
                    <span
                      id={`${mode.key}-puzzle`}
                      className="text-muted-foreground text-sm tabular-nums"
                    >
                      {getPuzzleLabel(mode.key) ?? "Daily puzzle"}
                    </span>
                  </span>
                  <span
                    id={`${mode.key}-description`}
                    className="text-muted-foreground font-body text-base leading-relaxed text-pretty"
                  >
                    {mode.description}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
