"use client";

import React, { useMemo } from "react";
import { ProgressBar } from "./ProgressBar";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

interface SwipeProgressBarProps {
  /** Array of guesses made so far */
  guesses: number[];
  /** Target year for the puzzle */
  targetYear: number;
  /** Array of events/hints for each guess */
  events: string[];
  /** Maximum number of guesses allowed */
  maxGuesses?: number;
  /** Callback when segment is clicked for review */
  onSegmentClick?: (index: number, guess: number, hint: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether swipe navigation is enabled (default: true on mobile) */
  enableSwipe?: boolean;
}

/**
 * Enhanced ProgressBar with swipe gesture support
 *
 * Maintains full compatibility with existing ProgressBar while adding:
 * - Touch-based swipe navigation between hints
 * - Visual feedback during gesture recognition
 * - Performance-optimized event handling
 * - Graceful fallback to click-only on desktop
 */
export const SwipeProgressBar: React.FC<SwipeProgressBarProps> = ({
  guesses,
  targetYear,
  events,
  maxGuesses = 6,
  onSegmentClick,
  className = "",
  enableSwipe = true,
}) => {
  // Calculate available hints (only filled segments are swipeable)
  const availableHints = useMemo(() => {
    return guesses
      .map((guess, index) => ({
        index,
        guess,
        hint: events[index] || "",
      }))
      .filter((item) => item.guess && item.hint);
  }, [guesses, events]);

  // Swipe navigation state
  const [currentSwipeIndex, setCurrentSwipeIndex] = React.useState(0);

  // Handle swipe navigation
  const handleSwipeNavigate = React.useCallback(
    (index: number) => {
      const targetHint = availableHints[index];
      if (targetHint && onSegmentClick) {
        setCurrentSwipeIndex(index);
        onSegmentClick(targetHint.index, targetHint.guess, targetHint.hint);
      }
    },
    [availableHints, onSegmentClick],
  );

  // Initialize swipe navigation hook
  const { touchHandlers, swipeProgress, isGestureActive } = useSwipeNavigation({
    totalHints: availableHints.length,
    currentIndex: currentSwipeIndex,
    onNavigate: handleSwipeNavigate,
    enabled: enableSwipe && availableHints.length > 1,
  });

  // Enhanced segment click handler that updates swipe index
  const handleSegmentClick = React.useCallback(
    (index: number, guess: number, hint: string) => {
      // Find the swipe index for this segment
      const swipeIndex = availableHints.findIndex((item) => item.index === index);
      if (swipeIndex >= 0) {
        setCurrentSwipeIndex(swipeIndex);
      }

      // Call original handler
      onSegmentClick?.(index, guess, hint);
    },
    [availableHints, onSegmentClick],
  );

  // Dynamic styling based on swipe state
  const containerStyles = useMemo(() => {
    const baseStyles: React.CSSProperties = {
      position: "relative",
      touchAction: enableSwipe ? "pan-y" : "auto", // Allow vertical scroll but handle horizontal
    };

    // Add visual feedback during active swipe
    if (isGestureActive && Math.abs(swipeProgress) > 0.1) {
      baseStyles.transform = `translateX(${swipeProgress * 10}px)`;
      baseStyles.transition = "none"; // Disable CSS transitions during gesture
    } else {
      baseStyles.transform = "translateX(0)";
      baseStyles.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
    }

    return baseStyles;
  }, [isGestureActive, swipeProgress, enableSwipe]);

  // Render swipe indicators if multiple hints are available
  const renderSwipeIndicators = () => {
    if (!enableSwipe || availableHints.length <= 1) return null;

    return (
      <div className="mt-2 flex items-center justify-center gap-2">
        {/* Left arrow indicator */}
        <div
          className={`flex h-4 w-4 items-center justify-center transition-opacity duration-200 ${
            currentSwipeIndex > 0 ? "opacity-60" : "opacity-20"
          }`}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path
              d="M8 2L4 6l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {availableHints.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-200 ${
                index === currentSwipeIndex
                  ? "bg-primary scale-125"
                  : "bg-border hover:bg-muted-foreground/50"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Right arrow indicator */}
        <div
          className={`flex h-4 w-4 items-center justify-center transition-opacity duration-200 ${
            currentSwipeIndex < availableHints.length - 1 ? "opacity-60" : "opacity-20"
          }`}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path
              d="M4 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="progress-bar-swipe-container">
      {/* Main progress bar with swipe handling */}
      <div
        style={containerStyles}
        {...(enableSwipe ? touchHandlers : {})}
        className={`${className} ${isGestureActive ? "select-none" : ""}`}
      >
        <ProgressBar
          guesses={guesses}
          targetYear={targetYear}
          events={events}
          maxGuesses={maxGuesses}
          onSegmentClick={handleSegmentClick}
        />
      </div>

      {/* Swipe navigation indicators */}
      {renderSwipeIndicators()}

      {/* Screen reader instructions */}
      {enableSwipe && availableHints.length > 1 && (
        <div className="sr-only" aria-live="polite">
          {isGestureActive
            ? `Swiping to navigate hints. Current: ${currentSwipeIndex + 1} of ${availableHints.length}`
            : `Swipe left or right to navigate between ${availableHints.length} available hints. Currently viewing hint ${currentSwipeIndex + 1}.`}
        </div>
      )}
    </div>
  );
};
