"use client";

import { useEffect, useRef } from "react";

import { useStreak } from "@/hooks/useStreak";
import { analytics, AnalyticsEvent } from "@/lib/analytics";
import { downloadDailyReminder } from "@/lib/reminder";
import { cn } from "@/lib/utils";

interface ReturnTomorrowCardProps {
  /** Countdown to local midnight, e.g. "02:39:04" */
  timeString: string;
  /** Mode whose completion screen hosts the card (analytics dimension) */
  mode: "classic" | "order";
  /**
   * Live streak from the page's own streak instance. useStreak state is
   * per-instance: the page that just ran updateStreak holds the fresh value,
   * while a newly mounted instance reads pre-completion storage. Pass this
   * wherever the hosting page tracks streaks (Classic); omit it where no
   * streak update happens at completion (Order).
   */
  currentStreak?: number;
  className?: string;
}

/** Tomorrow's puzzle time and an optional calendar reminder; never puzzle content. */
export function ReturnTomorrowCard({
  timeString,
  mode,
  currentStreak,
  className,
}: ReturnTomorrowCardProps) {
  const { streakData } = useStreak();
  const streak = currentStreak ?? streakData.currentStreak;

  // One view event per completion screen, not per re-render.
  const hasTrackedViewRef = useRef(false);
  useEffect(() => {
    if (!hasTrackedViewRef.current) {
      hasTrackedViewRef.current = true;
      analytics.track(AnalyticsEvent.RETURN_HOOK_SHOWN, { mode, streak });
    }
  }, [mode, streak]);

  const handleReminderClick = () => {
    analytics.track(AnalyticsEvent.REMINDER_OPTIN, { mode, streak });
    downloadDailyReminder();
  };

  return (
    <section
      aria-label="Come back tomorrow"
      className={cn("border-border w-full border-t py-5", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-body-primary text-lg font-semibold">
            {streak > 0 ? `${streak}-day streak` : "Come back tomorrow"}
          </p>
          <p className="text-muted-foreground text-sm">
            {streak > 0
              ? `Win tomorrow's puzzle to make it ${streak + 1}.`
              : "Win tomorrow's puzzle to start a streak."}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            New puzzle in{" "}
            <span
              role="timer"
              aria-label="Time until the next puzzle"
              className="text-body-primary font-mono font-semibold tabular-nums"
            >
              {timeString || "00:00:00"}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleReminderClick}
          className={cn(
            "border-border text-foreground inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold",
            "hover:bg-surface-inset transition-colors duration-150 motion-reduce:transition-none",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          {/* Inline bell: keeps the icon out of the JS bundle (size-limit) */}
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          Get a daily reminder
        </button>
      </div>
    </section>
  );
}
