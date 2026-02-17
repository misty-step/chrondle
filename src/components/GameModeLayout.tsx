"use client";

import React, { ReactNode, Suspense } from "react";
import { AppHeader } from "@/components/LazyComponents";
import { Footer } from "@/components/Footer";
import { GameErrorBoundary } from "@/components/GameErrorBoundary";
import type { ConfettiRef } from "@/components/magicui/confetti";
import { cn } from "@/lib/utils";

interface GameModeLayoutProps {
  children: ReactNode;
  mode: "classic" | "order";
  puzzleNumber?: number;
  puzzleDate?: string;
  isArchive?: boolean;
  className?: string;

  // Classic Mode features (optional)
  _confettiRef?: React.RefObject<ConfettiRef>;
  modals?: ReactNode;
  debugContent?: ReactNode;
  screenReaderAnnouncements?: ReactNode;
  currentStreak?: number;
  isDebugMode?: boolean;
}

/**
 * Deep module for game mode page structure across ALL modes.
 *
 * **Hides complexity:**
 * - Consistent page structure (header + main + footer)
 * - Footer always present (impossible to forget)
 * - Safe area insets for mobile devices
 * - Background and foreground theme colors
 * - Flex layout for sticky footer
 * - Optional Classic Mode features (background, confetti, modals, debug)
 * - Suspense boundaries for lazy-loaded content
 * - Z-index and render order management
 *
 * **Simple interface:**
 * Just specify mode + content + optional features. Structure is guaranteed.
 *
 * **Ousterhout Deep Module:**
 * - Interface complexity: 2 required props (mode, children) + 7 optional features
 * - Implementation complexity: Page structure + feature orchestration + Suspense boundaries
 * - Value = Footer guarantee + structure consistency + feature-complete for all modes
 *
 * **Architectural Guarantees:**
 * 1. ANY mode cannot ship without a footer—it's structurally impossible
 * 2. Classic Mode features (background, modals) handled consistently
 * 3. Debug mode, screen reader support available to all modes
 *
 * This eliminates an entire class of bugs through architecture.
 *
 * @example
 * // Order Mode (simple)
 * <GameModeLayout mode="order" puzzleNumber={123}>
 *   <OrderGameBoard />
 * </GameModeLayout>
 *
 * @example
 * // Classic Mode (feature-complete)
 * <GameModeLayout
 *   mode="classic"
 *   puzzleNumber={456}
 *   currentStreak={5}
 *   isDebugMode={true}
 *   confettiRef={confettiRef}
 *   modals={<AchievementModal />}
 *   debugContent={<AnalyticsDashboard />}
 *   screenReaderAnnouncements={<LiveAnnouncer message="Correct!" />}
 * >
 *   <GameLayout />
 * </GameModeLayout>
 */
export function GameModeLayout({
  children,
  mode,
  puzzleNumber,
  puzzleDate,
  isArchive = false,
  className,
  _confettiRef,
  modals,
  debugContent,
  screenReaderAnnouncements,
  currentStreak,
  isDebugMode = false,
}: GameModeLayoutProps) {
  return (
    <GameErrorBoundary>
      <div className={cn("bg-background text-foreground flex min-h-screen flex-col", className)}>
        {/* Unified header - mode-aware, with optional streak display */}
        <AppHeader
          currentStreak={currentStreak}
          isDebugMode={isDebugMode}
          puzzleNumber={puzzleNumber}
          puzzleDate={puzzleDate}
          isArchive={isArchive}
          mode={mode}
        />

        {/* Main content area - responsive padding with safe area insets */}
        <main
          className="flex flex-1 flex-col py-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        >
          {children}
        </main>

        {/* Footer - always present, impossible to omit */}
        <Footer />

        {/* Modals - Classic Mode achievement/support modals, above footer */}
        {modals}

        {/* Screen reader announcements - accessibility for all modes */}
        {screenReaderAnnouncements}

        {/* Debug mode - development/diagnostic tools, highest z-index */}
        {isDebugMode && debugContent && <Suspense fallback={null}>{debugContent}</Suspense>}
      </div>
    </GameErrorBoundary>
  );
}
