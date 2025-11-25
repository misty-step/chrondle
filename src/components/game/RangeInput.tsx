"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { EraToggle } from "@/components/ui/EraToggle";
import { SCORING_CONSTANTS } from "@/lib/scoring";
import { GAME_CONFIG } from "@/lib/constants";
import { convertToInternalYear, convertFromInternalYear, type Era } from "@/lib/eraUtils";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animationConstants";

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
  const prefersReducedMotion = useReducedMotion();
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
  const progressPercent = Math.min((width / SCORING_CONSTANTS.W_MAX) * 100, 100);

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

  // Format year for display
  const formatYearDisplay = (internalYear: number) => {
    if (internalYear < 0) {
      return `${Math.abs(internalYear)} BC`;
    }
    return `${internalYear} AD`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Onboarding message for first-time users */}
      {!hasBeenModified && !disabled && (
        <div className="bg-vermilion-50 dark:bg-vermilion-950/30 border-vermilion-200 dark:border-vermilion-800 rounded-sm border px-4 py-3">
          <p className="text-vermilion-700 dark:text-vermilion-300 flex items-center gap-2 text-sm font-medium">
            <span className="text-base" aria-hidden="true">
              💡
            </span>
            Adjust the years to narrow your range, then submit your guess
          </p>
        </div>
      )}

      {/* Ledger Entry Card */}
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
        {/* Section Header */}
        <div className="mb-6">
          <h3 className="text-section-title text-secondary">Your Guess</h3>
          <div className="ledger-divider mt-2" />
        </div>

        {/* Current Range Display */}
        <div className="bg-muted/30 mb-6 rounded-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Range
            </span>
            <span className="text-primary font-mono text-sm font-semibold tabular-nums">
              {formatYearDisplay(range[0])}
              <span className="text-muted-foreground mx-2">→</span>
              {formatYearDisplay(range[1])}
            </span>
          </div>
        </div>

        {/* Input Controls - Ledger Style */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:gap-12">
          {/* Start Year Group */}
          <div className="flex-1">
            <label
              htmlFor="start-year"
              className="text-muted-foreground mb-3 block text-[10px] font-bold tracking-[0.15em] uppercase"
            >
              From Year
            </label>
            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <input
                  id="start-year"
                  type="text"
                  inputMode="numeric"
                  value={startInput}
                  onChange={handleStartInputChange}
                  onBlur={applyStartYear}
                  onKeyDown={(e) => handleInputKeyDown(e, applyStartYear)}
                  disabled={disabled}
                  className={cn(
                    "ledger-entry-line w-full px-2 pt-1 pb-2 text-center font-mono text-3xl font-semibold tabular-nums",
                    "text-primary placeholder:text-muted-foreground/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  aria-label="Start year"
                />
              </div>
              <EraToggle
                value={startEra}
                onChange={handleStartEraChange}
                disabled={disabled}
                size="sm"
              />
            </div>
          </div>

          {/* Arrow Separator */}
          <div className="text-muted-foreground hidden pb-4 text-xl sm:block" aria-hidden="true">
            →
          </div>

          {/* End Year Group */}
          <div className="flex-1">
            <label
              htmlFor="end-year"
              className="text-muted-foreground mb-3 block text-[10px] font-bold tracking-[0.15em] uppercase"
            >
              To Year
            </label>
            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <input
                  id="end-year"
                  type="text"
                  inputMode="numeric"
                  value={endInput}
                  onChange={handleEndInputChange}
                  onBlur={applyEndYear}
                  onKeyDown={(e) => handleInputKeyDown(e, applyEndYear)}
                  disabled={disabled}
                  className={cn(
                    "ledger-entry-line w-full px-2 pt-1 pb-2 text-center font-mono text-3xl font-semibold tabular-nums",
                    "text-primary placeholder:text-muted-foreground/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  aria-label="End year"
                />
              </div>
              <EraToggle
                value={endEra}
                onChange={handleEndEraChange}
                disabled={disabled}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="ledger-divider my-6" />

        {/* Range Validation Section */}
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="range-progress">
            <div
              className="range-progress-fill"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
              data-exceeds={rangeTooWide}
            />
          </div>

          {/* Validation Status */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {width.toLocaleString()} of {SCORING_CONSTANTS.W_MAX.toLocaleString()} years
            </span>

            <AnimatePresence mode="wait">
              {rangeTooWide ? (
                <motion.span
                  key="error"
                  initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: -3 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="archival-stamp archival-stamp-error"
                >
                  Exceeds Limit
                </motion.span>
              ) : hasBeenModified ? (
                <motion.span
                  key="valid"
                  initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="text-feedback-success text-xs font-medium"
                >
                  ✓ Valid
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Submit Action */}
        <motion.div
          className="mt-6"
          whileHover={!commitDisabled && !prefersReducedMotion ? { y: -2 } : undefined}
          whileTap={!commitDisabled && !prefersReducedMotion ? { y: 1 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <Button
            onClick={handleRangeCommit}
            disabled={commitDisabled}
            variant="default"
            size="lg"
            className={cn(
              "h-14 w-full rounded-sm text-lg font-bold tracking-wide transition-shadow duration-200",
              "bg-vermilion-500 hover:bg-vermilion-600 border-vermilion-600 border-2 text-white",
              commitDisabled
                ? "cursor-not-allowed opacity-50 shadow-none"
                : "shadow-hard hover:shadow-hard-lg",
            )}
          >
            {isOneGuessMode ? "Lock In Final Guess" : "Submit Range"}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
