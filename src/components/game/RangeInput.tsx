"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EraToggle } from "@/components/ui/EraToggle";
import { SCORING_CONSTANTS } from "@/lib/scoring";
import { GAME_CONFIG } from "@/lib/constants";
import { convertToInternalYear, convertFromInternalYear, type Era } from "@/lib/eraUtils";
import { pluralize } from "@/lib/displayFormatting";
import { cn } from "@/lib/utils";

interface RangeInputProps {
  onCommit: (payload: { start: number; end: number; hintsUsed: number }) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
  hintsUsed?: number; // Number of historical events revealed (0-6)
  isOneGuessMode?: boolean; // Display "Submit Final Guess - ONE TRY" text
  // Controlled component props
  value?: [number, number]; // External range state (controlled mode)
  onChange?: (range: [number, number]) => void; // Range change callback
}

/**
 * Creates default range spanning the full timeline
 * This forces user to modify before submitting
 */
function createFullTimelineRange(minYear: number, maxYear: number): [number, number] {
  return [minYear, maxYear];
}

export function RangeInput({
  onCommit,
  minYear = GAME_CONFIG.MIN_YEAR,
  maxYear = GAME_CONFIG.MAX_YEAR,
  disabled = false,
  className,
  hintsUsed = 0,
  isOneGuessMode = false,
  value,
  onChange,
}: RangeInputProps) {
  const defaultRange = useMemo(() => createFullTimelineRange(minYear, maxYear), [minYear, maxYear]);
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalRange, setInternalRange] = useState<[number, number]>(defaultRange);
  const range = isControlled ? value : internalRange;

  const updateRange = useCallback(
    (newRange: [number, number]) => {
      if (isControlled) {
        onChange?.(newRange);
      } else {
        setInternalRange(newRange);
      }
    },
    [isControlled, onChange],
  );

  const [hasBeenModified, setHasBeenModified] = useState(false);
  const startEraYear = convertFromInternalYear(range[0]);
  const endEraYear = convertFromInternalYear(range[1]);

  const [startInput, setStartInput] = useState(String(startEraYear.year));
  const [endInput, setEndInput] = useState(String(endEraYear.year));
  const [startEra, setStartEra] = useState<Era>(startEraYear.era);
  const [endEra, setEndEra] = useState<Era>(endEraYear.era);

  useEffect(() => {
    const start = convertFromInternalYear(range[0]);
    const end = convertFromInternalYear(range[1]);

    setStartInput(String(start.year));
    setEndInput(String(end.year));
    setStartEra(start.era);
    setEndEra(end.era);
  }, [range]);

  useEffect(() => {
    if (!isControlled) {
      setInternalRange(defaultRange);
    }
    setHasBeenModified(false);
  }, [defaultRange, isControlled]);

  const width = range[1] - range[0] + 1;
  const rangeTooWide = width > SCORING_CONSTANTS.W_MAX;
  const commitDisabled = disabled || rangeTooWide || !hasBeenModified;

  const resetRange = useCallback(() => {
    updateRange(createFullTimelineRange(minYear, maxYear));
    setHasBeenModified(false);
  }, [minYear, maxYear, updateRange]);

  // --- Slider Interaction Logic ---

  const handleStartInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartInput(e.target.value);
  };

  const handleEndInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndInput(e.target.value);
  };

  const handleStartEraChange = (era: Era) => {
    setStartEra(era);
    const parsed = parseInt(startInput, 10);
    if (!Number.isNaN(parsed)) {
      const internalYear = convertToInternalYear(parsed, era);
      if (internalYear >= minYear && internalYear <= maxYear) {
        updateRange([internalYear, Math.max(internalYear, range[1])]);
        setHasBeenModified(true);
      }
    }
  };

  const handleEndEraChange = (era: Era) => {
    setEndEra(era);
    const parsed = parseInt(endInput, 10);
    if (!Number.isNaN(parsed)) {
      const internalYear = convertToInternalYear(parsed, era);
      if (internalYear >= minYear && internalYear <= maxYear) {
        updateRange([Math.min(range[0], internalYear), internalYear]);
        setHasBeenModified(true);
      }
    }
  };

  const applyStartYear = () => {
    const parsed = parseInt(startInput, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const internalYear = convertToInternalYear(parsed, startEra);
      if (internalYear >= minYear && internalYear <= maxYear) {
        updateRange([internalYear, Math.max(internalYear, range[1])]);
        setHasBeenModified(true);
      } else {
        const current = convertFromInternalYear(range[0]);
        setStartInput(String(current.year));
        setStartEra(current.era);
      }
    } else {
      const current = convertFromInternalYear(range[0]);
      setStartInput(String(current.year));
    }
  };

  const applyEndYear = () => {
    const parsed = parseInt(endInput, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const internalYear = convertToInternalYear(parsed, endEra);
      if (internalYear >= minYear && internalYear <= maxYear) {
        updateRange([Math.min(range[0], internalYear), internalYear]);
        setHasBeenModified(true);
      } else {
        const current = convertFromInternalYear(range[1]);
        setEndInput(String(current.year));
        setEndEra(current.era);
      }
    } else {
      const current = convertFromInternalYear(range[1]);
      setEndInput(String(current.year));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, applyFn: () => void) => {
    if (e.key === "Enter") applyFn();
  };

  const handleRangeCommit = () => {
    if (commitDisabled) return;
    onCommit({ start: range[0], end: range[1], hintsUsed });
    resetRange();
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Timeline Header */}
      <div className="border-outline-default flex items-baseline justify-between border-b pb-2">
        <h3 className="text-secondary font-sans text-xs font-bold tracking-[0.2em] uppercase">
          Target Range
        </h3>
        <div className="text-primary font-mono font-medium tabular-nums">
          {range[0] < 0 ? `${Math.abs(range[0])} BC` : `${range[0]} AD`}
          <span className="text-tertiary mx-2">–</span>
          {range[1] < 0 ? `${Math.abs(range[1])} BC` : `${range[1]} AD`}
        </div>
      </div>

      {/* Interactive Ruler Card */}
      <div
        className={cn(
          "material-card group relative p-6 transition-all sm:p-8",
          rangeTooWide
            ? "border-feedback-error/50"
            : hasBeenModified
              ? "border-vermilion-500"
              : "border-outline-default",
        )}
      >
        {/* Decorative Ruler Marks (Top/Bottom) */}
        <div className="pointer-events-none absolute top-0 right-4 left-4 flex h-2 justify-between opacity-30">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="bg-outline-default h-full w-px" />
          ))}
        </div>
        <div className="pointer-events-none absolute right-4 bottom-0 left-4 flex h-2 justify-between opacity-30">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="bg-outline-default h-full w-px" />
          ))}
        </div>

        {/* Input Controls */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
          {/* Start Year Group */}
          <div className="flex-1 space-y-2">
            <label className="text-tertiary mb-1 block text-[10px] font-bold tracking-[0.1em] uppercase">
              From Year
              <div className="mt-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="start-year"
                    type="text"
                    inputMode="numeric"
                    value={startInput}
                    onChange={handleStartInputChange}
                    onBlur={applyStartYear}
                    onKeyDown={(e) => handleInputKeyDown(e, applyStartYear)}
                    disabled={disabled}
                    className="bg-surface-elevated border-outline-default focus:border-vermilion-500 focus:ring-vermilion-500/20 text-primary h-12 text-center font-serif text-2xl"
                  />
                </div>
                <EraToggle
                  value={startEra}
                  onChange={handleStartEraChange}
                  disabled={disabled}
                  size="default"
                />
              </div>
            </label>
          </div>

          {/* Link Icon */}
          <div className="text-tertiary hidden items-center justify-center pb-3 sm:flex">→</div>

          {/* End Year Group */}
          <div className="flex-1 space-y-2">
            <label className="text-tertiary mb-1 block text-[10px] font-bold tracking-[0.1em] uppercase">
              To Year
              <div className="mt-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="end-year"
                    type="text"
                    inputMode="numeric"
                    value={endInput}
                    onChange={handleEndInputChange}
                    onBlur={applyEndYear}
                    onKeyDown={(e) => handleInputKeyDown(e, applyEndYear)}
                    disabled={disabled}
                    className="bg-surface-elevated border-outline-default focus:border-vermilion-500 focus:ring-vermilion-500/20 text-primary h-12 text-center font-serif text-2xl"
                  />
                </div>
                <EraToggle
                  value={endEra}
                  onChange={handleEndEraChange}
                  disabled={disabled}
                  size="default"
                />
              </div>
            </label>
          </div>
        </div>

        {/* Validation Message */}
        <div className="mt-4 flex h-8 items-center justify-center">
          {rangeTooWide ? (
            <div className="text-feedback-error flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <span className="border-feedback-error border-b-2 pb-0.5">
                ⚠️ Range too wide ({pluralize(width, "year")})
              </span>
            </div>
          ) : (
            <div className="text-tertiary font-mono text-xs">
              Span: {width.toLocaleString()} years
            </div>
          )}
        </div>

        {/* Submit Action */}
        <Button
          onClick={handleRangeCommit}
          disabled={commitDisabled}
          variant={commitDisabled ? "outline" : "default"}
          size="lg"
          className={cn(
            "mt-2 h-14 w-full text-lg transition-all duration-300",
            !commitDisabled && "shadow-hard hover:shadow-hard-lg hover:translate-y-[-2px]",
          )}
        >
          {isOneGuessMode ? "Lock In Final Guess" : "Submit Range"}
        </Button>
      </div>
    </div>
  );
}
