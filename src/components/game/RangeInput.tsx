"use client";

import React, { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EraToggle } from "@/components/kit/EraToggle";
import { SCORING_CONSTANTS, computeScoreBreakdown } from "@/lib/scoring";
import { GAME_CONFIG } from "@/lib/constants";
import { convertToInternalYear, convertFromInternalYear, type Era } from "@/lib/eraUtils";
import { formatYearRange, formatYearStandard } from "@/lib/displayFormatting";
import { cn } from "@/lib/utils";
import type { HintCount } from "@/types/range";

interface RangeInputProps {
  onCommit: (payload: {
    start: number;
    end: number;
    hintsUsed: number;
  }) => void | boolean | Promise<void | boolean>;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
  className?: string;
  hintsUsed?: number;
  isOneGuessMode?: boolean;
  value?: [number, number];
  onChange?: (range: [number, number]) => void;
}

type YearField = "start" | "end";
interface YearDraft {
  text: string;
  era: Era;
  touched: boolean;
}
interface RangeDraft {
  key: string;
  start: YearDraft;
  end: YearDraft;
}

function createDraft(key: string, value?: [number, number]): RangeDraft {
  const field = (year?: number): YearDraft => {
    const converted = year ? convertFromInternalYear(year) : null;
    return {
      text: converted ? String(converted.year) : "",
      era: converted?.era ?? "AD",
      touched: false,
    };
  };
  return { key, start: field(value?.[0]), end: field(value?.[1]) };
}

function parseYear(draft: YearDraft, minYear: number, maxYear: number): number | null {
  if (!/^\d+$/.test(draft.text.trim())) return null;
  const year = Number(draft.text);
  if (!Number.isSafeInteger(year) || year <= 0) return null;
  const internalYear = convertToInternalYear(year, draft.era);
  return internalYear >= minYear && internalYear <= maxYear ? internalYear : null;
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
  const id = useId();
  const endRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const controlled = value !== undefined && onChange !== undefined;
  const key = `${minYear}:${maxYear}:${controlled ? value.join(":") : "internal"}`;
  const [storedDraft, setDraft] = useState(() => createDraft(key, controlled ? value : undefined));
  const draft =
    storedDraft.key === key ? storedDraft : createDraft(key, controlled ? value : undefined);
  const start = parseYear(draft.start, minYear, maxYear);
  const end = parseYear(draft.end, minYear, maxYear);
  const hasRange = start !== null && end !== null;
  const rangeStart = hasRange ? Math.min(start, end) : 0;
  const rangeEnd = hasRange ? Math.max(start, end) : 0;
  const width = hasRange ? rangeEnd - rangeStart + 1 : 0;
  const tooWide = width > SCORING_CONSTANTS.W_MAX;
  const valid = hasRange && !tooWide;
  const hints = Math.min(Math.max(Math.floor(hintsUsed), 0), 6) as HintCount;
  const possibleScore = valid
    ? computeScoreBreakdown(rangeStart, rangeEnd, hints).potentialScore
    : null;
  const inactive = disabled || isSubmitting;

  const updateField = (field: YearField, change: Partial<YearDraft>) => {
    const next = { ...draft, [field]: { ...draft[field], ...change } };
    const nextStart = parseYear(next.start, minYear, maxYear);
    const nextEnd = parseYear(next.end, minYear, maxYear);
    if (controlled && nextStart !== null && nextEnd !== null) {
      const range: [number, number] = [Math.min(nextStart, nextEnd), Math.max(nextStart, nextEnd)];
      next.key = `${minYear}:${maxYear}:${range.join(":")}`;
      onChange(range);
    }
    setDraft(next);
    setSubmissionError(null);
  };

  const commitRange = async () => {
    if (!valid || inactive || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const committed = await onCommit({ start: rangeStart, end: rangeEnd, hintsUsed: hints });
      if (committed === false) {
        setSubmissionError("Your guess wasn’t saved. Try again.");
        return;
      }
      if (controlled) onChange([0, 0]);
      setDraft(createDraft(`${minYear}:${maxYear}:${controlled ? "0:0" : "internal"}`));
    } catch {
      setSubmissionError("Your guess wasn’t saved. Try again.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("border-border bg-surface-elevated rounded-2xl border p-5 sm:p-6", className)}
    >
      <h3 id={`${id}-title`} className="font-display text-foreground text-xl font-semibold">
        Your range
      </h3>
      <p id={`${id}-help`} className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Enter two years. Use the same year for an exact guess.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-6">
        {(["start", "end"] as const).map((field) => {
          const entry = draft[field];
          const invalid =
            entry.touched && entry.text !== "" && parseYear(entry, minYear, maxYear) === null;
          const errorId = `${id}-${field}-error`;
          return (
            <div key={field} className="min-w-0">
              <label
                htmlFor={`${id}-${field}`}
                className="text-foreground mb-2 block text-sm font-medium"
              >
                {field === "start" ? "From year" : "To year"}
              </label>
              <input
                id={`${id}-${field}`}
                ref={field === "end" ? endRef : undefined}
                aria-label={field === "start" ? "Start year" : "End year"}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                placeholder="Year"
                value={entry.text}
                disabled={inactive}
                onChange={(event) =>
                  updateField(field, { text: event.target.value, touched: false })
                }
                onBlur={() => updateField(field, { touched: true })}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (field === "start") endRef.current?.focus();
                  else if (valid) submitRef.current?.focus();
                }}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : `${id}-help`}
                className={cn(
                  "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 h-14 w-full rounded-lg border px-3 font-mono text-2xl tabular-nums outline-none focus-visible:ring-2 disabled:opacity-50 sm:text-3xl",
                  invalid && "border-feedback-error",
                )}
              />
              <EraToggle
                value={entry.era}
                onChange={(era) => updateField(field, { era })}
                disabled={inactive}
                aria-label={field === "start" ? "Start year era" : "End year era"}
                width="full"
                className="mt-2"
              />
              {invalid && (
                <p id={errorId} role="alert" className="text-feedback-error mt-2 text-sm">
                  Enter a whole year from {formatYearStandard(minYear)} to{" "}
                  {formatYearStandard(maxYear)}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="border-border mt-5 min-h-16 border-t pt-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {hasRange ? (
          <>
            <p className="text-foreground text-sm font-medium">
              {formatYearRange(rangeStart, rangeEnd)}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {width.toLocaleString()} {width === 1 ? "year" : "years"} wide
              </span>
              {possibleScore !== null && (
                <span className="text-foreground">
                  <strong className="font-mono tabular-nums">{possibleScore}</strong> pts if correct
                </span>
              )}
            </div>
            {tooWide && (
              <p role="alert" className="text-feedback-error mt-2 text-sm">
                Narrow your range to {SCORING_CONSTANTS.W_MAX} years or fewer.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Up to {SCORING_CONSTANTS.W_MAX} years wide. Narrower ranges earn more points.
          </p>
        )}
      </div>

      <Button
        ref={submitRef}
        type="button"
        onClick={commitRange}
        disabled={!valid || inactive}
        soundCue={false}
        className="bg-feedback-success text-feedback-success-foreground hover:bg-feedback-success-hover mt-5 h-12 w-full rounded-xl text-base font-semibold tracking-normal normal-case"
      >
        {isSubmitting ? "Saving guess…" : isOneGuessMode ? "Lock in range" : "Submit range"}
      </Button>
      {isOneGuessMode && (
        <p className="text-muted-foreground mt-2 text-center text-xs">One guess. Make it count.</p>
      )}
      {submissionError && (
        <p role="alert" className="text-feedback-error mt-3 text-sm">
          {submissionError}
        </p>
      )}
    </section>
  );
}
