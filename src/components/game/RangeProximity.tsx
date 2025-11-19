"use client";

import React from "react";
import { computeProximityScale } from "@/lib/proximityScale";
import { formatYear } from "@/lib/displayFormatting";

interface RangeProximityProps {
  rangeStart: number;
  rangeEnd: number;
  targetYear?: number;
  missDistance?: number | null;
  missDirection?: "earlier" | "later" | "inside" | null;
  windowYears: number;
  children?: React.ReactNode;
}

export function RangeProximity({
  rangeStart,
  rangeEnd,
  targetYear,
  missDistance,
  missDirection,
  windowYears,
  children,
}: RangeProximityProps) {
  const scale = computeProximityScale({ rangeStart, rangeEnd, targetYear });
  const hasTarget = typeof targetYear === "number";

  // Determine hero text based on miss distance
  const heroText =
    missDistance === null || missDistance === undefined || missDirection === null
      ? null
      : missDistance === 0
        ? "CONTAINED!"
        : missDirection === "earlier"
          ? `${missDistance.toLocaleString()} ${missDistance === 1 ? "YEAR" : "YEARS"} TOO LATE`
          : `${missDistance.toLocaleString()} ${missDistance === 1 ? "YEAR" : "YEARS"} TOO EARLY`;

  // Determine subtitle based on direction
  const subtitle =
    missDistance === null || missDistance === undefined || missDirection === null
      ? `${formatYear(rangeStart)} – ${formatYear(rangeEnd)}`
      : `${windowYears}-year window`;

  return (
    <div className="border-border bg-background rounded-xl border-2 px-6 py-5 shadow-lg">
      {/* Hero text with subtitle - left-aligned, subtle hierarchy */}
      {heroText && (
        <div className="mb-4 space-y-1">
          <div className="text-foreground text-2xl leading-tight font-bold tracking-tight">
            {heroText}
          </div>
          <div className="text-muted-foreground text-sm">{subtitle}</div>
        </div>
      )}

      {/* Timeline visualization - generous spacing */}
      <div className="space-y-2">
        <div className="bg-muted/70 relative h-3 rounded-full">
          <div
            className="bg-primary/35 absolute inset-y-0 rounded-full"
            style={{
              left: `${scale.rangeStartPct}%`,
              width: `${Math.max(2, scale.rangeEndPct - scale.rangeStartPct)}%`,
            }}
            aria-label={`Range ${formatYear(rangeStart)} – ${formatYear(rangeEnd)}`}
          />

          {hasTarget && scale.targetPct !== null && (
            <div
              className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `calc(${scale.targetPct}% - 8px)` }}
            >
              <span className="border-background flex h-4 w-4 items-center justify-center rounded-full border-2 bg-rose-500 text-[0.55rem] font-bold text-white" />
            </div>
          )}
        </div>

        <div className="text-muted-foreground flex justify-between text-[0.65rem] tracking-wide uppercase">
          <span>{formatYear(scale.axisStart)}</span>
          <span>{formatYear(scale.axisEnd)}</span>
        </div>
      </div>

      {/* Hints bar - left-aligned below timeline */}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
