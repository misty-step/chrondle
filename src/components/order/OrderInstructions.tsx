"use client";

import { useMemo } from "react";
import { ModeHero } from "@/components/ui/ModeHero";
import { formatYear } from "@/lib/displayFormatting";
import type { OrderEvent } from "@/types/orderGameState";

interface OrderInstructionsProps {
  puzzleNumber: number;
  events: OrderEvent[];
  par?: number;
  strokes?: number;
}

export function OrderInstructions({
  puzzleNumber,
  events,
  par,
  strokes = 0,
}: OrderInstructionsProps) {
  const yearSpan = useMemo(() => {
    if (events.length === 0) return "0 years";

    const years = events.map((event) => event.year);
    const earliest = Math.min(...years);
    const latest = Math.max(...years);
    const span = Math.abs(latest - earliest);

    if (span >= 1000) {
      const thousands = Math.round(span / 100) / 10;
      return `${thousands.toLocaleString()}k years`;
    }
    return `${span.toLocaleString()} years`;
  }, [events]);

  const earliestYear = useMemo(() => {
    if (events.length === 0) return 0;
    return Math.min(...events.map((e) => e.year));
  }, [events]);

  const latestYear = useMemo(() => {
    if (events.length === 0) return 0;
    return Math.max(...events.map((e) => e.year));
  }, [events]);

  const subtitle =
    strokes === 0 ? "Arrange events from earliest to latest" : "Adjust and check again";

  return (
    <ModeHero title="Order Mode" subtitle={subtitle} eyebrow={`Daily puzzle · №${puzzleNumber}`}>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {/* Timeline span badge */}
        <div className="border-border/50 bg-muted/30 inline-flex items-center gap-2 rounded-sm border px-3 py-1.5">
          <span className="font-year text-muted-foreground text-xs">
            {formatYear(earliestYear)}
          </span>
          <span className="text-muted-foreground/50">→</span>
          <span className="font-year text-muted-foreground text-xs">{formatYear(latestYear)}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-muted-foreground text-xs italic">{yearSpan}</span>
        </div>

        {/* Golf scoring badge */}
        {par !== undefined && (
          <div className="border-primary/30 bg-primary/5 inline-flex items-center gap-2 rounded-sm border px-3 py-1.5">
            <span className="text-primary text-xs font-medium">Par {par}</span>
            {strokes > 0 && (
              <>
                <span className="text-primary/30">·</span>
                <span className="text-primary text-xs">
                  {strokes} {strokes === 1 ? "stroke" : "strokes"}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </ModeHero>
  );
}
