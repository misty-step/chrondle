"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { OrderEvent } from "@/types/orderGameState";
import { formatYear } from "@/lib/displayFormatting";

interface DocumentHeaderProps {
  puzzleNumber: number;
  date: string;
  events: OrderEvent[];
}

export function DocumentHeader({ puzzleNumber, date, events }: DocumentHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  const { earliestYear, latestYear, formattedSpan } = useMemo(() => {
    if (events.length === 0) {
      return { earliestYear: 0, latestYear: 0, formattedSpan: "0 years" };
    }

    const years = events.map((event) => event.year);
    const earliest = Math.min(...years);
    const latest = Math.max(...years);
    const span = Math.abs(latest - earliest);

    // Format span nicely
    let formatted;
    if (span >= 1000) {
      const thousands = Math.round(span / 100) / 10;
      formatted = `${thousands.toLocaleString()}k years`;
    } else {
      formatted = `${span.toLocaleString()} years`;
    }

    return { earliestYear: earliest, latestYear: latest, formattedSpan: formatted };
  }, [events]);

  const formattedDate = useMemo(() => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }, [date]);

  return (
    <motion.div
      className="bg-card border-border shadow-warm rounded-xl border p-4 md:p-5"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: -12 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.4, ease: "easeOut" }}
    >
      {/* Header Row */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-muted-foreground font-sans text-[10px] font-semibold tracking-widest uppercase">
            Chronological Sorting Exercise
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="text-primary font-year font-semibold">Puzzle №{puzzleNumber}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground font-sans">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Timeline Range Visualization */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <div className="bg-timeline-spine/20 relative h-[3px] overflow-hidden rounded-full">
            <div
              className="absolute inset-y-0 right-0 left-0 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, var(--timeline-spine), var(--timeline-marker))",
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-year text-timeline-marker text-xs font-semibold">
              {formatYear(earliestYear)}
            </span>
            <span className="text-muted-foreground font-sans text-xs italic">{formattedSpan}</span>
            <span className="font-year text-timeline-marker text-xs font-semibold">
              {formatYear(latestYear)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
