"use client";

import { useCallback, useRef, useState } from "react";

type DragTarget = "start" | "end" | "new" | null;

export interface TimelineRangeBarProps {
  /** Earliest selectable internal year (negative = BC). */
  minYear: number;
  /** Latest selectable internal year. */
  maxYear: number;
  /** Current draft range in internal year units. Ignored visually until `hasValue`. */
  value: [number, number];
  /** Whether `value` reflects a range the player actually drew (vs. the unset default). */
  hasValue: boolean;
  /** Fired continuously during drag/keyboard adjustment with the next candidate range. */
  onChange: (range: [number, number]) => void;
  disabled?: boolean;
  className?: string;
}

const FINE_STEP = 1;
const COARSE_STEP = 10;

function formatTimelineYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
}

/**
 * A single-gesture range picker: press-drag-release directly on the timeline
 * draws a range anchored at the press point (not a fixed default), with live
 * width feedback via `onChange` on every pointer move. Once a range exists,
 * the two edges become independently draggable and keyboard-adjustable
 * `role="slider"` handles for fine-tuning.
 *
 * Deliberately player-driven only: this component never reads or infers the
 * puzzle answer, so it cannot leak era/year information (puzzle-integrity
 * red line).
 */
export function TimelineRangeBar({
  minYear,
  maxYear,
  value,
  hasValue,
  onChange,
  disabled = false,
  className,
}: TimelineRangeBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<number | null>(null);
  const dragTargetRef = useRef<DragTarget>(null);
  const [isDragging, setIsDragging] = useState(false);

  const span = Math.max(1, maxYear - minYear);

  const yearFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return minYear;
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(minYear + fraction * span);
    },
    [minYear, span],
  );

  const pctFor = useCallback(
    (year: number) => {
      const clamped = Math.min(maxYear, Math.max(minYear, year));
      return ((clamped - minYear) / span) * 100;
    },
    [minYear, maxYear, span],
  );

  const applyPointerYear = useCallback(
    (clientX: number) => {
      const year = yearFromClientX(clientX);
      const target = dragTargetRef.current;

      if (target === "start") {
        onChange([Math.min(year, value[1]), value[1]]);
      } else if (target === "end") {
        onChange([value[0], Math.max(year, value[0])]);
      } else if (target === "new") {
        const anchor = anchorRef.current ?? year;
        onChange([Math.min(anchor, year), Math.max(anchor, year)]);
      }
    },
    [onChange, value, yearFromClientX],
  );

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    trackRef.current?.setPointerCapture?.(e.pointerId);
    const year = yearFromClientX(e.clientX);
    anchorRef.current = year;
    dragTargetRef.current = "new";
    setIsDragging(true);
    onChange([year, year]);
  };

  const handleEdgePointerDown =
    (edge: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();
      trackRef.current?.setPointerCapture?.(e.pointerId);
      dragTargetRef.current = edge;
      setIsDragging(true);
    };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    applyPointerYear(e.clientX);
  };

  const endDrag = () => {
    setIsDragging(false);
    dragTargetRef.current = null;
    anchorRef.current = null;
  };

  const handleEdgeKeyDown = (edge: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled) return;
    const delta = e.shiftKey ? COARSE_STEP : FINE_STEP;
    let [nextStart, nextEnd] = value;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        if (edge === "start") nextStart = Math.max(minYear, value[0] - delta);
        else nextEnd = Math.max(value[0], value[1] - delta);
        break;
      case "ArrowRight":
      case "ArrowUp":
        if (edge === "start") nextStart = Math.min(value[1], value[0] + delta);
        else nextEnd = Math.min(maxYear, value[1] + delta);
        break;
      case "Home":
        if (edge === "start") nextStart = minYear;
        else nextEnd = value[0];
        break;
      case "End":
        if (edge === "start") nextStart = value[1];
        else nextEnd = maxYear;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange([nextStart, nextEnd]);
  };

  const showZeroTick = minYear < 0 && maxYear > 0;

  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-testid="timeline-range-track"
        className={`bg-muted/60 relative h-11 touch-none rounded-full transition-colors select-none ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/80 cursor-crosshair"
        }`}
      >
        {showZeroTick && (
          <div
            aria-hidden="true"
            className="bg-border absolute top-0 h-full w-px"
            style={{ left: `${pctFor(0)}%` }}
          />
        )}

        {hasValue && (
          <div
            aria-hidden="true"
            className="bg-primary/40 absolute inset-y-0 rounded-full"
            style={{
              left: `${pctFor(value[0])}%`,
              width: `${Math.max(0.6, pctFor(value[1]) - pctFor(value[0]))}%`,
            }}
          />
        )}

        {hasValue && (
          <>
            <div
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label="Start year handle"
              aria-valuemin={minYear}
              aria-valuemax={value[1]}
              aria-valuenow={value[0]}
              aria-valuetext={formatTimelineYear(value[0])}
              aria-disabled={disabled}
              onPointerDown={handleEdgePointerDown("start")}
              onKeyDown={handleEdgeKeyDown("start")}
              data-testid="timeline-handle-start"
              className="border-primary bg-background focus-visible:ring-primary absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md outline-none focus-visible:ring-2"
              style={{ left: `${pctFor(value[0])}%` }}
            />
            <div
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label="End year handle"
              aria-valuemin={value[0]}
              aria-valuemax={maxYear}
              aria-valuenow={value[1]}
              aria-valuetext={formatTimelineYear(value[1])}
              aria-disabled={disabled}
              onPointerDown={handleEdgePointerDown("end")}
              onKeyDown={handleEdgeKeyDown("end")}
              data-testid="timeline-handle-end"
              className="border-primary bg-background focus-visible:ring-primary absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md outline-none focus-visible:ring-2"
              style={{ left: `${pctFor(value[1])}%` }}
            />
          </>
        )}
      </div>

      <div className="text-muted-foreground flex justify-between text-[0.65rem] tracking-wide uppercase">
        <span>{formatTimelineYear(minYear)}</span>
        <span>{formatTimelineYear(maxYear)}</span>
      </div>
    </div>
  );
}
