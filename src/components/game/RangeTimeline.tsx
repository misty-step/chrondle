"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";

import { ANIMATION_SPRINGS, useReducedMotion } from "@/lib/animationConstants";
import { cn } from "@/lib/utils";

export interface RangeTimelineRange {
  start: number;
  end: number;
  score: number;
  contained: boolean;
  hintsUsed: number;
}

export interface RangeTimelineProps {
  ranges: RangeTimelineRange[];
  targetYear: number | null;
  minYear?: number;
  maxYear?: number;
  isComplete: boolean;
  className?: string;
}

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 200;
const AXIS_Y = 110;
const BAR_HEIGHT = 18;
const BAR_GAP = 10;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function yearToX(year: number, minYear: number, maxYear: number): number {
  const safeMax = Math.max(maxYear, minYear + 1);
  const clampedYear = clamp(year, minYear, safeMax);
  const ratio = (clampedYear - minYear) / (safeMax - minYear);
  return ratio * VIEWBOX_WIDTH;
}

export function RangeTimeline({
  ranges,
  targetYear,
  minYear = -5000,
  maxYear = new Date().getFullYear(),
  isComplete,
  className,
}: RangeTimelineProps) {
  const shouldReduceMotion = useReducedMotion();

  const visualRanges = useMemo(() => {
    if (ranges.length === 0) {
      return [];
    }

    return ranges.map((range, index) => {
      const startX = yearToX(range.start, minYear, maxYear);
      const endX = yearToX(range.end, minYear, maxYear);
      const width = Math.max(endX - startX, 2);
      const y = 20 + index * (BAR_HEIGHT + BAR_GAP);

      return {
        key: `${range.start}-${range.end}-${index}`,
        x: startX,
        width,
        y,
        color: range.contained ? "#16a34a" : "#dc2626",
        score: range.score,
      };
    });
  }, [ranges, minYear, maxYear]);

  const showAnswerMarker = isComplete && typeof targetYear === "number";
  const emptyState = ranges.length === 0;

  return (
    <div className={cn("border-border bg-card rounded-lg border p-4 shadow-sm", className)}>
      <div className="text-muted-foreground mb-3 flex items-center justify-between text-sm">
        <span>Timeline</span>
        <span>
          {minYear} – {maxYear}
        </span>
      </div>
      {emptyState ? (
        <p className="text-muted-foreground text-sm">Submit a range to see it on the timeline.</p>
      ) : (
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="h-48 w-full"
          role="img"
          aria-label="Range timeline"
        >
          {/* Axis */}
          <line
            x1={0}
            y1={AXIS_Y}
            x2={VIEWBOX_WIDTH}
            y2={AXIS_Y}
            stroke="currentColor"
            strokeWidth={2}
            opacity={0.4}
          />

          {/* Answer marker */}
          {showAnswerMarker && (
            <line
              data-testid="answer-marker"
              x1={yearToX(targetYear!, minYear, maxYear)}
              y1={0}
              x2={yearToX(targetYear!, minYear, maxYear)}
              y2={VIEWBOX_HEIGHT}
              stroke="#fbbf24"
              strokeWidth={3}
              strokeDasharray="6 6"
            />
          )}

          {visualRanges.map((range) => (
            <motion.g
              key={range.key}
              layout={!shouldReduceMotion}
              transition={shouldReduceMotion ? undefined : ANIMATION_SPRINGS.SMOOTH}
            >
              <rect
                data-testid="range-bar"
                x={range.x}
                y={range.y}
                width={range.width}
                height={BAR_HEIGHT}
                rx={4}
                fill={range.color}
                opacity={0.6}
              />
              <text
                x={range.x + range.width / 2}
                y={range.y + BAR_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={12}
                fill="#000"
              >
                {range.score} pts
              </text>
            </motion.g>
          ))}
        </svg>
      )}
    </div>
  );
}
