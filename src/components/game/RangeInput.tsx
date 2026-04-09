"use client";

import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lightbulb } from "@phosphor-icons/react";
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
function createFullTimelineRange(_minYear: number, _maxYear: number): [number, number] {
  return [0, 0];
}

interface InternalRangeState {
  boundsKey: string;
  range: [number, number];
}

interface RangeDraftState {
  syncedRangeKey: string;
  startInput: string;
  endInput: string;
  startEra: Era;
  endEra: Era;
  startError: string | null;
  endError: string | null;
  hasBeenModified: boolean;
}

function getBoundsKey(minYear: number, maxYear: number) {
  return `${minYear}:${maxYear}`;
}

function getRangeKey(range: [number, number]) {
  return `${range[0]}:${range[1]}`;
}

function createDraftState(
  range: [number, number],
  hasBeenModified: boolean = false,
): RangeDraftState {
  const start = convertFromInternalYear(range[0]);
  const end = convertFromInternalYear(range[1]);

  return {
    syncedRangeKey: getRangeKey(range),
    startInput: String(start.year),
    endInput: String(end.year),
    startEra: start.era,
    endEra: end.era,
    startError: null,
    endError: null,
    hasBeenModified,
  };
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
  const boundsKey = useMemo(() => getBoundsKey(minYear, maxYear), [minYear, maxYear]);
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalRangeState, setInternalRangeState] = useState<InternalRangeState>(() => ({
    boundsKey,
    range: defaultRange,
  }));
  const internalRange =
    internalRangeState.boundsKey === boundsKey ? internalRangeState.range : defaultRange;
  const range = isControlled ? value : internalRange;
  const rangeKey = getRangeKey(range);
  const [draftState, setDraftState] = useState<RangeDraftState>(() => createDraftState(range));
  const draft = draftState.syncedRangeKey === rangeKey ? draftState : createDraftState(range);
  const { startInput, endInput, startEra, endEra, startError, endError, hasBeenModified } = draft;

  const updateRange = useCallback(
    (newRange: [number, number]) => {
      if (isControlled) {
        onChange?.(newRange);
      } else {
        setInternalRangeState({
          boundsKey,
          range: newRange,
        });
      }
    },
    [boundsKey, isControlled, onChange],
  );

  const width = range[1] - range[0] + 1;
  const rangeTooWide = width > SCORING_CONSTANTS.W_MAX;
  const commitDisabled = disabled || rangeTooWide || !hasBeenModified;
  const progressPercent = Math.min((width / SCORING_CONSTANTS.W_MAX) * 100, 100);

  const resetRange = useCallback(() => {
    const nextRange = createFullTimelineRange(minYear, maxYear);
    updateRange(nextRange);
    setDraftState(createDraftState(nextRange));
  }, [minYear, maxYear, updateRange]);

  // --- Slider Interaction Logic ---

  const handleStartEraChange = (era: Era) => {
    const parsed = parseInt(startInput, 10);
    if (!Number.isNaN(parsed)) {
      const internalYear = convertToInternalYear(parsed, era);
      if (internalYear >= minYear && internalYear <= maxYear) {
        const nextRange: [number, number] = [internalYear, Math.max(internalYear, range[1])];
        updateRange(nextRange);
        setDraftState(createDraftState(nextRange, true));
        return;
      }
    }

    setDraftState({
      ...draft,
      startEra: era,
    });
  };

  const handleEndEraChange = (era: Era) => {
    const parsed = parseInt(endInput, 10);
    if (!Number.isNaN(parsed)) {
      const internalYear = convertToInternalYear(parsed, era);
      if (internalYear >= minYear && internalYear <= maxYear) {
        const nextRange: [number, number] = [Math.min(range[0], internalYear), internalYear];
        updateRange(nextRange);
        setDraftState(createDraftState(nextRange, true));
        return;
      }
    }

    setDraftState({
      ...draft,
      endEra: era,
    });
  };

  const applyStartYear = () => {
    const parsed = parseInt(startInput, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const internalYear = convertToInternalYear(parsed, startEra);
      if (internalYear >= minYear && internalYear <= maxYear) {
        const nextRange: [number, number] = [internalYear, Math.max(internalYear, range[1])];
        updateRange(nextRange);
        setDraftState(createDraftState(nextRange, true));
      } else {
        setDraftState({
          ...draft,
          startError: formatValidRangeMessage(),
        });
      }
    } else if (startInput.trim() === "") {
      // Empty input - reset silently
      const current = convertFromInternalYear(range[0]);
      setDraftState({
        ...draft,
        startInput: String(current.year),
        startEra: current.era,
        startError: null,
      });
    } else {
      setDraftState({
        ...draft,
        startError: "Enter a valid year",
      });
    }
  };

  const applyEndYear = () => {
    const parsed = parseInt(endInput, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const internalYear = convertToInternalYear(parsed, endEra);
      if (internalYear >= minYear && internalYear <= maxYear) {
        const nextRange: [number, number] = [Math.min(range[0], internalYear), internalYear];
        updateRange(nextRange);
        setDraftState(createDraftState(nextRange, true));
      } else {
        setDraftState({
          ...draft,
          endError: formatValidRangeMessage(),
        });
      }
    } else if (endInput.trim() === "") {
      // Empty input - reset silently
      const current = convertFromInternalYear(range[1]);
      setDraftState({
        ...draft,
        endInput: String(current.year),
        endEra: current.era,
        endError: null,
      });
    } else {
      setDraftState({
        ...draft,
        endError: "Enter a valid year",
      });
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

  // Format valid range message for errors
  const formatValidRangeMessage = () => {
    return `Valid range: ${formatYearDisplay(minYear)} to ${formatYearDisplay(maxYear)}`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Onboarding message for first-time users */}
      {!hasBeenModified && !disabled && (
        <div className="rounded border border-[#4a9b7f] bg-[#4a9b7f]/10 px-4 py-3 dark:bg-[#4a9b7f]/20">
          <p className="flex items-center gap-2 text-sm font-medium text-[#3d8268] dark:text-[#5fb899]">
            <Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" />
            Adjust the years to narrow your range, then submit your guess
          </p>
        </div>
      )}

      {/* Ledger Entry Card */}
      <div
        className={cn(
          "group border-border bg-surface-elevated relative rounded border p-6 transition-all sm:p-8",
          rangeTooWide
            ? "border-feedback-error/50"
            : hasBeenModified
              ? "border-[#4a9b7f]"
              : "border-outline-default",
        )}
      >
        {/* Section Header */}
        <div className="mb-6">
          <h3 className="text-section-title text-body-secondary">Your Guess</h3>
          <div className="ledger-divider mt-2" />
        </div>

        {/* Current Range Display */}
        <div className="bg-muted/30 mb-6 rounded px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Range
            </span>
            <span className="text-body-primary font-mono text-sm font-semibold tabular-nums">
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
                  onChange={(e) => {
                    setDraftState({
                      ...draft,
                      startInput: e.target.value,
                      startError: null,
                    });
                  }}
                  onBlur={applyStartYear}
                  onKeyDown={(e) => handleInputKeyDown(e, applyStartYear)}
                  disabled={disabled}
                  className={cn(
                    "ledger-entry-line w-full px-2 pt-1 pb-2 text-center font-mono text-3xl font-semibold tabular-nums",
                    "text-body-primary placeholder:text-muted-foreground/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    startError && "border-feedback-error text-feedback-error border-b-2",
                  )}
                  aria-label="Start year"
                  aria-invalid={!!startError}
                  aria-describedby={startError ? "start-year-error" : undefined}
                />
              </div>
              <EraToggle
                value={startEra}
                onChange={handleStartEraChange}
                disabled={disabled}
                size="sm"
              />
            </div>
            {startError && (
              <p
                id="start-year-error"
                className="text-feedback-error mt-2 flex items-center gap-1.5 text-xs font-medium"
                role="alert"
              >
                <span aria-hidden="true">⚠</span>
                {startError}
              </p>
            )}
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
                  onChange={(e) => {
                    setDraftState({
                      ...draft,
                      endInput: e.target.value,
                      endError: null,
                    });
                  }}
                  onBlur={applyEndYear}
                  onKeyDown={(e) => handleInputKeyDown(e, applyEndYear)}
                  disabled={disabled}
                  className={cn(
                    "ledger-entry-line w-full px-2 pt-1 pb-2 text-center font-mono text-3xl font-semibold tabular-nums",
                    "text-body-primary placeholder:text-muted-foreground/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    endError && "border-feedback-error text-feedback-error border-b-2",
                  )}
                  aria-label="End year"
                  aria-invalid={!!endError}
                  aria-describedby={endError ? "end-year-error" : undefined}
                />
              </div>
              <EraToggle
                value={endEra}
                onChange={handleEndEraChange}
                disabled={disabled}
                size="sm"
              />
            </div>
            {endError && (
              <p
                id="end-year-error"
                className="text-feedback-error mt-2 flex items-center gap-1.5 text-xs font-medium"
                role="alert"
              >
                <span aria-hidden="true">⚠</span>
                {endError}
              </p>
            )}
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
                  initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="text-feedback-error text-xs font-semibold"
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
              "h-14 w-full rounded text-lg font-bold tracking-wide transition-shadow duration-200",
              "border-2 border-[#4a9b7f] bg-[#4a9b7f] text-white hover:bg-[#4a9b7f]",
              commitDisabled ? "cursor-not-allowed opacity-50 shadow-none" : "",
            )}
          >
            {isOneGuessMode ? "Lock In Final Guess" : "Submit Range"}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
