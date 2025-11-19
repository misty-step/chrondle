"use client";

import { useMemo } from "react";
import type { OrderEvent } from "@/types/orderGameState";

interface TimelineContextBarProps {
  events: OrderEvent[];
}

export function TimelineContextBar({ events }: TimelineContextBarProps) {
  const formattedSpan = useMemo(() => {
    if (events.length === 0) {
      return "0 years";
    }

    const years = events.map((event) => event.year);
    const earliest = Math.min(...years);
    const latest = Math.max(...years);
    const yearSpan = Math.abs(latest - earliest);

    // Format span nicely
    if (yearSpan >= 1000) {
      const thousands = Math.round(yearSpan / 100) / 10;
      return `~${thousands.toLocaleString()}k years`;
    } else {
      return `~${yearSpan.toLocaleString()} years`;
    }
  }, [events]);

  return (
    <div className="flex justify-center">
      <div className="bg-muted/30 border-muted-foreground/20 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
        <span className="text-muted-foreground text-xs font-medium uppercase">Timeline Span:</span>
        <span className="text-foreground text-xs font-semibold">{formattedSpan}</span>
      </div>
    </div>
  );
}
