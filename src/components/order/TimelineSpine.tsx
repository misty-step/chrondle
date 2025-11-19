"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { OrderEvent, OrderHint } from "@/types/orderGameState";
import { formatYear } from "@/lib/displayFormatting";

interface TimelineSpineProps {
  events: OrderEvent[];
  currentOrder: string[];
  hints?: OrderHint[];
  className?: string;
}

export function TimelineSpine({ events, currentOrder, hints = [], className }: TimelineSpineProps) {
  const prefersReducedMotion = useReducedMotion();

  // Calculate timeline boundaries
  const { earliestYear, latestYear, yearSpan } = useMemo(() => {
    if (!events.length) return { earliestYear: 0, latestYear: 0, yearSpan: 0 };

    const years = events.map((e) => e.year);
    const earliest = Math.min(...years);
    const latest = Math.max(...years);
    return {
      earliestYear: earliest,
      latestYear: latest,
      yearSpan: latest - earliest,
    };
  }, [events]);

  // Generate era markers (centuries)
  const eraMarkers = useMemo(() => {
    if (yearSpan === 0) return [];

    const markers: Array<{ year: number; label: string; position: number }> = [];
    const centuryInterval = yearSpan > 2000 ? 500 : yearSpan > 500 ? 100 : 50;

    // Round to nearest century
    const startCentury = Math.floor(earliestYear / centuryInterval) * centuryInterval;
    const endCentury = Math.ceil(latestYear / centuryInterval) * centuryInterval;

    for (let year = startCentury; year <= endCentury; year += centuryInterval) {
      if (year >= earliestYear && year <= latestYear) {
        const position = ((year - earliestYear) / yearSpan) * 100;
        markers.push({
          year,
          label: formatYear(year),
          position,
        });
      }
    }

    return markers;
  }, [earliestYear, latestYear, yearSpan]);

  // Extract anchor hints for visualization
  const anchorHints = useMemo(() => {
    return hints.filter((h): h is Extract<OrderHint, { type: "anchor" }> => h.type === "anchor");
  }, [hints]);

  // Extract bracket hints for visualization
  const bracketHints = useMemo(() => {
    return hints.filter((h): h is Extract<OrderHint, { type: "bracket" }> => h.type === "bracket");
  }, [hints]);

  if (!events.length) {
    return null;
  }

  return (
    <div className={`relative ${className || ""}`}>
      {/* Main Timeline Spine */}
      <motion.div
        className="absolute top-0 bottom-0 left-0 w-[3px] rounded-full"
        style={{
          background:
            "linear-gradient(to bottom, var(--timeline-spine) 0%, var(--timeline-marker) 100%)",
        }}
        initial={prefersReducedMotion ? undefined : { scaleY: 0, opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { scaleY: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }
        }
      />

      {/* Era Markers */}
      {eraMarkers.map((marker, index) => (
        <motion.div
          key={`${marker.year}-${index}`}
          className="absolute left-0 flex items-center gap-2"
          style={{
            top: `${marker.position}%`,
            transform: "translateY(-50%)",
          }}
          initial={prefersReducedMotion ? undefined : { opacity: 0, x: -10 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  delay: 0.3 + index * 0.05,
                  duration: 0.4,
                }
          }
        >
          {/* Tick Mark */}
          <div
            className="h-[2px] w-3 rounded-full"
            style={{ backgroundColor: "var(--timeline-era-label)" }}
          />

          {/* Era Label */}
          <span
            className="font-year text-[10px] tracking-wide"
            style={{ color: "var(--timeline-era-label)" }}
          >
            {marker.label}
          </span>
        </motion.div>
      ))}

      {/* Anchor Hint Pins */}
      {anchorHints.map((hint) => {
        const event = events.find((e) => e.id === hint.eventId);
        if (!event) return null;

        const eventIndex = currentOrder.indexOf(event.id);
        if (eventIndex === -1) return null;

        const positionPercent = (eventIndex / (currentOrder.length - 1)) * 100;

        return (
          <motion.div
            key={`anchor-${hint.eventId}`}
            className="absolute left-0 flex items-center justify-center"
            style={{
              top: `${positionPercent}%`,
              transform: "translate(-50%, -50%)",
            }}
            initial={prefersReducedMotion ? undefined : { scale: 0, opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { scale: 1, opacity: 1 }}
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }
            }
          >
            <div
              className="h-3 w-3 rounded-full border-2"
              style={{
                backgroundColor: "var(--locked-badge-bg)",
                borderColor: "var(--locked-badge)",
              }}
            />
          </motion.div>
        );
      })}

      {/* Bracket Hint Ranges */}
      {bracketHints.map((hint) => {
        const event = events.find((e) => e.id === hint.eventId);
        if (!event || yearSpan === 0) return null;

        const [startYear, endYear] = hint.yearRange;
        const startPos = ((startYear - earliestYear) / yearSpan) * 100;
        const endPos = ((endYear - earliestYear) / yearSpan) * 100;
        const height = endPos - startPos;

        return (
          <motion.div
            key={`bracket-${hint.eventId}`}
            className="absolute left-0 -ml-1 rounded opacity-20"
            style={{
              top: `${startPos}%`,
              height: `${height}%`,
              width: "12px",
              backgroundColor: "var(--primary)",
            }}
            initial={prefersReducedMotion ? undefined : { opacity: 0, scaleY: 0 }}
            animate={prefersReducedMotion ? undefined : { opacity: 0.2, scaleY: 1 }}
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 0.4,
                    ease: "easeOut",
                  }
            }
          />
        );
      })}
    </div>
  );
}
