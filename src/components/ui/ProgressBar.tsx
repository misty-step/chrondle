"use client";

import React, { useState, useCallback, useMemo } from "react";
import { formatYear } from "@/lib/displayFormatting";

interface ProgressBarProps {
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
}

interface DistanceColor {
  threshold: number;
  colorClass: string;
  fillColor: string;
  label: string;
}

// Distance-based color mapping for segments
const DISTANCE_COLORS: DistanceColor[] = [
  {
    threshold: 0,
    colorClass: "distance-perfect",
    fillColor: "#16A34A",
    label: "Perfect!",
  },
  {
    threshold: 5,
    colorClass: "distance-close",
    fillColor: "#22C55E",
    label: "Very close",
  },
  {
    threshold: 25,
    colorClass: "distance-near",
    fillColor: "#84CC16",
    label: "Close",
  },
  {
    threshold: 50,
    colorClass: "distance-far",
    fillColor: "#FACC15",
    label: "Somewhat far",
  },
  {
    threshold: 100,
    colorClass: "distance-very-far",
    fillColor: "#FB923C",
    label: "Far",
  },
  {
    threshold: 500,
    colorClass: "distance-way-off",
    fillColor: "#EF4444",
    label: "Very far",
  },
  {
    threshold: Infinity,
    colorClass: "distance-extreme",
    fillColor: "#B91C1C",
    label: "Extremely far",
  },
];

function getDistanceColor(distance: number): DistanceColor {
  // Linear search is optimal for small array (7 elements)
  for (let i = DISTANCE_COLORS.length - 1; i >= 0; i--) {
    if (distance >= DISTANCE_COLORS[i].threshold) {
      return DISTANCE_COLORS[i];
    }
  }
  return DISTANCE_COLORS[0];
}

interface ProgressSegment {
  id: number;
  guess: number | null;
  distance: number;
  colorClass: string;
  fillColor: string;
  label: string;
  accessible: boolean;
  hint: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  guesses,
  targetYear,
  events,
  maxGuesses = 6,
  onSegmentClick,
  className = "",
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  // Pre-calculate segment data for optimal performance
  const segments = useMemo((): ProgressSegment[] => {
    return Array.from({ length: maxGuesses }, (_, index) => {
      const guess = guesses[index] || null;
      const distance = guess ? Math.abs(guess - targetYear) : 0;
      const distanceData = guess ? getDistanceColor(distance) : DISTANCE_COLORS[0];
      const hint = events[index] || "";

      return {
        id: index,
        guess,
        distance,
        colorClass: guess ? distanceData.colorClass : "",
        fillColor: guess ? distanceData.fillColor : "var(--input)",
        label: guess ? distanceData.label : "Not yet guessed",
        accessible: Boolean(guess && hint),
        hint,
      };
    });
  }, [guesses, targetYear, events, maxGuesses]);

  // Handle segment click with event delegation for performance
  const handleSegmentClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const segmentElement = target.closest("[data-segment-id]") as HTMLElement;

      if (!segmentElement) return;

      const segmentId = parseInt(segmentElement.dataset.segmentId || "", 10);
      const segment = segments[segmentId];

      if (!segment || !segment.accessible || !onSegmentClick) return;

      // Haptic feedback for mobile
      if ("vibrate" in navigator) {
        navigator.vibrate(10);
      }

      onSegmentClick(segmentId, segment.guess!, segment.hint);
    },
    [segments, onSegmentClick],
  );

  // Calculate filled segments count
  const filledSegments = guesses.length;

  return (
    <div className={`progress-bar-container ${className}`}>
      <div
        className="progress-segments"
        onClick={handleSegmentClick}
        role="group"
        aria-label={`Game progress: ${filledSegments} of ${maxGuesses} guesses made`}
      >
        {segments.map((segment) => {
          const isFilled = segment.guess !== null;
          const isHovered = hoveredSegment === segment.id;

          return (
            <div
              key={segment.id}
              data-segment-id={segment.id}
              className={`progress-segment ${isFilled ? "filled" : ""} ${segment.colorClass} ${
                segment.accessible ? "clickable" : ""
              }`}
              style={
                {
                  "--segment-fill-color": segment.fillColor,
                } as React.CSSProperties
              }
              onMouseEnter={() => setHoveredSegment(segment.id)}
              onMouseLeave={() => setHoveredSegment(null)}
              role={segment.accessible ? "button" : "presentation"}
              tabIndex={segment.accessible ? 0 : -1}
              aria-label={
                segment.accessible
                  ? `Guess ${segment.id + 1}: ${formatYear(segment.guess!)}. ${segment.label}.`
                  : `Guess ${segment.id + 1}: ${segment.label}`
              }
              aria-pressed={segment.accessible ? false : undefined}
            >
              {/* Fill animation element */}
              {isFilled && (
                <div
                  className="segment-fill"
                  style={{
                    backgroundColor: segment.fillColor,
                    animationDelay: `${segment.id * 100}ms`,
                  }}
                />
              )}

              {/* Accessibility content */}
              <span className="sr-only">{segment.guess ? formatYear(segment.guess) : "Empty"}</span>

              {/* Hover tooltip */}
              {segment.accessible && isHovered && (
                <div className="segment-tooltip" role="tooltip">
                  <div className="font-semibold">{formatYear(segment.guess!)}</div>
                  <div className="text-sm opacity-75">{segment.label}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress label */}
      <div className="progress-label" aria-live="polite">
        <span className="text-muted-foreground text-xs font-medium">
          {filledSegments}/{maxGuesses} guesses
        </span>
      </div>
    </div>
  );
};
