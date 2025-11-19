"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EraToggle } from "@/components/ui/EraToggle";
import { SCORING_CONSTANTS } from "@/lib/scoring";
import { GAME_CONFIG } from "@/lib/constants";
import { convertToInternalYear, convertFromInternalYear, type Era } from "@/lib/eraUtils";
import { formatYearWithOptions, pluralize } from "@/lib/displayFormatting";
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
  value,
  onChange,
}: RangeInputProps) {
  const defaultRange = useMemo(() => createFullTimelineRange(minYear, maxYear), [minYear, maxYear]);

  // Check if controlled
  const isControlled = value !== undefined && onChange !== undefined;

  // Internal year representation (negative = BC) - only used when uncontrolled
  const [internalRange, setInternalRange] = useState<[number, number]>(defaultRange);

  // Use external state if controlled, internal state if uncontrolled
  const range = isControlled ? value : internalRange;

  // Internal setter that respects controlled/uncontrolled mode
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

  // Track if user has modified the range from default
  const [hasBeenModified, setHasBeenModified] = useState(false);

  // Convert internal years to UI representation
  const startEraYear = convertFromInternalYear(range[0]);
  const endEraYear = convertFromInternalYear(range[1]);

  // UI state for year inputs (positive numbers only)
  const [startInput, setStartInput] = useState(String(startEraYear.year));
  const [endInput, setEndInput] = useState(String(endEraYear.year));

  // UI state for era toggles
  const [startEra, setStartEra] = useState<Era>(startEraYear.era);
  const [endEra, setEndEra] = useState<Era>(endEraYear.era);

  // Sync UI state when internal range changes
  useEffect(() => {
    const start = convertFromInternalYear(range[0]);
    const end = convertFromInternalYear(range[1]);

    setStartInput(String(start.year));
    setEndInput(String(end.year));
    setStartEra(start.era);
    setEndEra(end.era);
  }, [range]);

  // Reset to default when bounds change
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

  const handleStartInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartInput(e.target.value);
  };

  const handleEndInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndInput(e.target.value);
  };

  const handleStartEraChange = (era: Era) => {
    setStartEra(era);
    // Immediately apply era change if we have a valid year
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
    // Immediately apply era change if we have a valid year
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
        // Reset to current valid value
        const current = convertFromInternalYear(range[0]);
        setStartInput(String(current.year));
        setStartEra(current.era);
      }
    } else {
      // Reset to current valid value
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
        // Reset to current valid value
        const current = convertFromInternalYear(range[1]);
        setEndInput(String(current.year));
        setEndEra(current.era);
      }
    } else {
      // Reset to current valid value
      const current = convertFromInternalYear(range[1]);
      setEndInput(String(current.year));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, applyFn: () => void) => {
    if (e.key === "Enter") {
      applyFn();
    }
  };

  const handleRangeCommit = () => {
    if (commitDisabled) return;
    onCommit({ start: range[0], end: range[1], hintsUsed });
    resetRange();
  };

  return (
    <div className={cn("space-y-5", className)}>
      {/* Section Header with Range Summary */}
      <div className="flex items-baseline justify-between border-b pb-2">
        <h3 className="text-foreground text-sm font-semibold tracking-wider uppercase">
          Your Guess
        </h3>
        <span className="text-muted-foreground text-xs">
          {formatYearWithOptions(range[0])} – {formatYearWithOptions(range[1])}
        </span>
      </div>

      {/* Form Card Container */}
      <div
        className={cn(
          "from-background to-muted/20 rounded-xl bg-gradient-to-br p-6 shadow-lg transition-all sm:p-8",
          rangeTooWide
            ? "border-destructive/30 border-3"
            : hasBeenModified
              ? "border-primary/40 border-3"
              : "border-primary/10 border-3",
        )}
      >
        {/* Range Inputs - Grid layout with labels */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-center sm:gap-6">
          {/* Start Year Input Group */}
          <div className="flex flex-1 flex-col gap-2">
            <label
              htmlFor="start-year"
              className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              Start Year
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="start-year"
                type="text"
                inputMode="numeric"
                value={startInput}
                onChange={handleStartInputChange}
                onBlur={applyStartYear}
                onKeyDown={(e) => handleInputKeyDown(e, applyStartYear)}
                disabled={disabled}
                className="h-12 flex-1 border-2 text-center text-xl font-semibold focus-visible:shadow-lg"
                aria-label="Start year"
              />
              <EraToggle
                value={startEra}
                onChange={handleStartEraChange}
                disabled={disabled}
                size="lg"
              />
            </div>
          </div>

          {/* End Year Input Group */}
          <div className="flex flex-1 flex-col gap-2">
            <label
              htmlFor="end-year"
              className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              End Year
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="end-year"
                type="text"
                inputMode="numeric"
                value={endInput}
                onChange={handleEndInputChange}
                onBlur={applyEndYear}
                onKeyDown={(e) => handleInputKeyDown(e, applyEndYear)}
                disabled={disabled}
                className="h-12 flex-1 border-2 text-center text-xl font-semibold focus-visible:shadow-lg"
                aria-label="End year"
              />
              <EraToggle
                value={endEra}
                onChange={handleEndEraChange}
                disabled={disabled}
                size="lg"
              />
            </div>
          </div>
        </div>

        {/* Range Width Display - Only show when invalid */}
        {rangeTooWide && (
          <div className="border-destructive/30 bg-destructive/5 mt-5 rounded-lg border-2 p-3 text-center transition-all">
            <div className="text-destructive text-2xl font-bold tabular-nums">
              {pluralize(width, "year")}
            </div>
            <div className="text-destructive mt-1 text-xs font-medium">
              Max: {SCORING_CONSTANTS.W_MAX.toLocaleString()} years
            </div>
          </div>
        )}

        {/* Submit Button with gradient and arrow */}
        <Button
          onClick={handleRangeCommit}
          disabled={commitDisabled}
          size="lg"
          className="from-primary to-primary/80 shadow-primary/25 mt-6 h-14 w-full bg-gradient-to-r text-lg font-semibold shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:scale-100"
        >
          Submit Range
          <span className="ml-2 text-xl">→</span>
        </Button>
      </div>
    </div>
  );
}
