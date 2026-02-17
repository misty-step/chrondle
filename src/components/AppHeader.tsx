"use client";

import React from "react";
import Link from "next/link";
import { Flame, Archive } from "lucide-react";

import { AuthButtons } from "@/components/AuthButtons";
import { AdminButton } from "@/components/AdminButton";
import { LayoutContainer } from "@/components/LayoutContainer";
import { ModeDropdown } from "@/components/ModeDropdown";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NavbarButton } from "@/components/ui/NavbarButton";
import { getStreakColorClasses } from "@/lib/ui/streak-styling";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/displayFormatting";

interface AppHeaderProps {
  currentStreak?: number;
  isDebugMode?: boolean;
  puzzleNumber?: number;
  puzzleDate?: string;
  isArchive?: boolean;
  mode?: "classic" | "order";
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
    <>
      <header
        className="w-full border-b border-[var(--elevation-navbar-border)] bg-[var(--elevation-navbar-bg)] py-4"
        style={{ boxShadow: "var(--elevation-navbar-shadow)" }}
      >
        <LayoutContainer className="transition-all duration-200 ease-out">
          <div className="flex min-h-[40px] items-center justify-between">
            {/* Logo/Brand - with integrated mode switcher */}
            <div className="flex h-10 items-baseline gap-2">
              <Link href="/" className="flex items-baseline">
                <h1 className="font-display text-body-primary m-0 flex cursor-pointer items-baseline text-2xl transition-opacity hover:opacity-80 md:text-3xl">
                  <span className="flex h-10 w-10 items-center justify-center sm:hidden">C</span>
                  <span className="hidden sm:inline">CHRONDLE</span>
                </h1>
              </Link>

              {/* Mode Dropdown inline with brand */}
              <span className="bg-border hidden h-4 w-px sm:inline" aria-hidden="true" />
              <ModeDropdown className="hidden sm:inline-flex" />

              {/* Puzzle Number and Date */}
              {puzzleNumber && (
                <>
                  <span className="bg-border hidden h-4 w-px sm:inline" aria-hidden="true" />
                  <span
                    className={cn(
                      "font-mono text-xs sm:text-sm",
                      isArchive ? "text-muted-foreground italic" : "text-foreground/70",
                    )}
                  >
                    {`#${puzzleNumber}`}
                    {puzzleDate && (
                      <span className="text-muted-foreground/60 ml-1.5 hidden text-xs sm:inline">
                        • {formatDate(puzzleDate)}
                      </span>
                    )}
                  </span>
                </>
              )}

              {isDebugMode && (
                <span
                  className="ml-2 h-2 w-2 rounded-full bg-orange-600 opacity-75"
                  title="Debug mode active"
                  aria-label="Debug mode indicator"
                />
              )}
            </div>

            {/* Action Buttons with Streak Counter */}
            <div className="flex h-10 items-center gap-3">
              {/* Streak Counter - Archival Badge */}
              {currentStreak !== undefined && currentStreak > 0 && streakColors && (
                <div
                  className={`flex items-center gap-2 rounded border-2 px-3 py-2 ${streakColors.borderColor} h-10`}
                  title={streakColors.milestone || `${currentStreak} day streak`}
                  aria-label={`Current streak: ${currentStreak} day streak`}
                >
                  <Flame className={`h-4 w-4 ${streakColors.textColor}`} />
                  <span
                    className={`font-accent text-sm font-bold ${streakColors.textColor} whitespace-nowrap`}
                  >
                    <span className="hidden sm:inline">{currentStreak} day streak</span>
                    <span className="sm:hidden">{currentStreak}</span>
                  </span>
                </div>
              )}

              {/* Mobile Mode Dropdown */}
              <ModeDropdown className="flex sm:hidden" />

              {/* Archive Button */}
              <NavbarButton
                href={archiveHref}
                title="Browse puzzle archive"
                aria-label="Browse puzzle archive"
                overlayColor="primary"
                className="flex"
              >
                <Archive className="h-5 w-5" />
              </NavbarButton>

              {/* Admin Button - Only visible to admins */}
              <AdminButton className="hidden sm:flex" />

              {/* Theme Toggle */}
              <ThemeToggle className="flex" />

              {/* Auth Buttons - Rightmost */}
              <AuthButtons className="flex" />
            </div>
          </div>
        </LayoutContainer>
      </header>
    </>
  );
};
