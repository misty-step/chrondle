"use client";

import React from "react";
import Link from "next/link";
import { Fire, Archive } from "@/components/kit/icons";

import { AuthButtons } from "@/components/AuthButtons";
import { AdminButton } from "@/components/AdminButton";
import { LayoutContainer } from "@/components/LayoutContainer";
import { ModeDropdown } from "@/components/ModeDropdown";
import { ThemeToggle } from "@/components/kit/ThemeToggle";
import { SoundToggle } from "@/components/kit/SoundToggle";
import { NavbarButton } from "@/components/kit/NavbarButton";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/displayFormatting";
import { getStreakColorClasses } from "@/lib/ui/streak-styling";

interface AppHeaderProps {
  currentStreak?: number;
  isDebugMode?: boolean;
  puzzleNumber?: number;
  puzzleDate?: string;
  isArchive?: boolean;
  mode?: "classic" | "order" | "duel";
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentStreak,
  isDebugMode = false,
  puzzleNumber,
  puzzleDate,
  isArchive = false,
  mode = "classic",
}) => {
  const streakColors = currentStreak ? getStreakColorClasses(currentStreak) : null;
  const archiveHref = mode === "order" ? "/archive/order" : "/archive";

  return (
    <header className="bg-background border-border sticky top-0 z-40 w-full border-b py-2">
      <LayoutContainer>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-5">
          <div className="flex min-w-0 items-center gap-2">
            {/* A valued query parameter keeps the gallery reachable when the
                mode-preference cookie redirects bare `/` to a game. */}
            <Link
              href="/?all=1"
              className="font-display text-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex min-h-11 items-center rounded-sm text-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Chrondle
            </Link>
            {isDebugMode && (
              <span
                className="bg-feedback-warning h-2 w-2 shrink-0 rounded-full"
                title="Debug mode active"
                aria-label="Debug mode indicator"
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 lg:col-start-3 lg:row-start-1">
            <SoundToggle />
            <ThemeToggle />
            <AuthButtons />
          </div>

          <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <nav aria-label="Game navigation" className="flex items-center gap-1">
              <ModeDropdown />
              <NavbarButton
                href={archiveHref}
                title="Browse puzzle archive"
                aria-label="Browse puzzle archive"
              >
                <Archive className="h-5 w-5" aria-hidden="true" />
              </NavbarButton>
              <AdminButton />
            </nav>

            <div className="text-muted-foreground flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
              {puzzleNumber && (
                <span
                  className={cn(
                    "inline-flex flex-wrap items-center gap-x-2",
                    isArchive && "italic",
                  )}
                >
                  <span aria-label={`Puzzle ${puzzleNumber}`}>#{puzzleNumber}</span>
                  {puzzleDate && (
                    <time dateTime={puzzleDate} className="hidden sm:inline">
                      {formatDate(puzzleDate)}
                    </time>
                  )}
                </span>
              )}
              {currentStreak !== undefined && currentStreak > 0 && streakColors && (
                <div
                  className="flex items-center gap-1.5"
                  title={streakColors.milestone || `${currentStreak} day streak`}
                  aria-label={`Current streak: ${currentStreak} day streak`}
                >
                  <Fire className={cn("h-4 w-4", streakColors.textColor)} aria-hidden="true" />
                  <span className="font-medium">
                    {currentStreak}
                    <span className="hidden sm:inline"> day streak</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </LayoutContainer>
    </header>
  );
};
