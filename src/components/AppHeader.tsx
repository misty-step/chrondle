"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Archive, Heart } from "lucide-react";

import { AuthButtons } from "@/components/AuthButtons";
import SupportModal from "@/components/SupportModal";
import { ModeDropdown } from "@/components/ModeDropdown";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NavbarButton } from "@/components/ui/NavbarButton";
import { formatPuzzleNumber } from "@/lib/puzzleUtils";
import { getStreakColorClasses } from "@/lib/ui/streak-styling";
import { cn } from "@/lib/utils";

// Constants
const HEARTBEAT_DELAY_MS = 2000;
const HEARTBEAT_DURATION_MS = 3000;

interface AppHeaderProps {
  currentStreak?: number;
  isDebugMode?: boolean;
  puzzleNumber?: number;
  isArchive?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentStreak,
  isDebugMode = false,
  puzzleNumber,
  isArchive = false,
}) => {
  const pathname = usePathname();
  const [showSupport, setShowSupport] = useState(false);
  const [showHeartbeat, setShowHeartbeat] = useState(false);

  useEffect(() => {
    // Show heartbeat animation once per session
    const hasShownHeartbeat = sessionStorage.getItem("heartbeatShown");
    if (!hasShownHeartbeat) {
      setTimeout(() => {
        setShowHeartbeat(true);
        sessionStorage.setItem("heartbeatShown", "true");
        setTimeout(() => setShowHeartbeat(false), HEARTBEAT_DURATION_MS);
      }, HEARTBEAT_DELAY_MS);
    }
  }, []);

  const streakColors = currentStreak ? getStreakColorClasses(currentStreak) : null;

  // Adaptive navbar width based on game mode
  const isOrderMode = pathname?.startsWith("/order");
  const maxWidthClass = isOrderMode ? "max-w-4xl" : "max-w-2xl";
  return (
    <>
      <header className="border-border bg-card w-full border-b py-4">
        <div
          className={cn("mx-auto px-6 transition-all duration-200 ease-out sm:px-0", maxWidthClass)}
        >
          <div className="flex min-h-[40px] items-center justify-between">
            {/* Logo/Brand - with integrated mode switcher */}
            <div className="flex h-10 items-baseline gap-2">
              <Link href="/" className="flex items-baseline">
                <h1 className="font-heading text-primary m-0 flex cursor-pointer items-baseline text-2xl font-bold transition-opacity hover:opacity-80 md:text-3xl">
                  <span className="flex h-10 w-10 items-center justify-center sm:hidden">C</span>
                  <span className="hidden sm:inline">CHRONDLE</span>
                </h1>
              </Link>

              {/* Mode Dropdown inline with brand */}
              <span className="text-muted-foreground hidden text-xl sm:inline">·</span>
              <ModeDropdown className="hidden sm:inline-flex" />

              {/* Puzzle Number */}
              {puzzleNumber && (
                <>
                  <span className="text-muted-foreground hidden text-xl sm:inline">·</span>
                  <span
                    className={cn(
                      "font-mono text-xs sm:text-sm",
                      isArchive ? "text-muted-foreground italic" : "text-foreground/70",
                    )}
                  >
                    {formatPuzzleNumber(puzzleNumber)}
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
              {/* Streak Counter - Horizontal Badge */}
              {currentStreak !== undefined && currentStreak > 0 && streakColors && (
                <div
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 ${streakColors.borderColor} h-10 shadow-sm`}
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
                href={isOrderMode ? "/archive/order" : "/archive"}
                title="Browse puzzle archive"
                aria-label="Browse puzzle archive"
                overlayColor="primary"
              >
                <Archive className="h-5 w-5" />
              </NavbarButton>

              {/* Support Button */}
              <NavbarButton
                onClick={() => setShowSupport(true)}
                title="Support Chrondle"
                aria-label="Support Chrondle"
                overlayColor="rose"
                className={cn(showHeartbeat && "animate-heartbeat")}
              >
                <Heart className="text-foreground h-4 w-4 transition-colors group-hover:text-rose-600" />
              </NavbarButton>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Auth Buttons - Rightmost */}
              <AuthButtons />
            </div>
          </div>
        </div>
      </header>

      <SupportModal open={showSupport} onOpenChange={setShowSupport} />
    </>
  );
};
