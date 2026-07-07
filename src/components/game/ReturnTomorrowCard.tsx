"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BellRinging } from "@phosphor-icons/react";

import { useStreak } from "@/hooks/useStreak";
import { analytics, AnalyticsEvent } from "@/lib/analytics";
import { downloadDailyReminder } from "@/lib/reminder";
import { ANIMATION_DURATIONS, msToSeconds } from "@/lib/animationConstants";
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

/**
 * The completion return hook (design-lab winner C2).
 *
 * Replaces the passive "Next puzzle in …" countdown at the moment of maximal
 * engagement with an explicit next-day contract: streak stake ("win tomorrow
 * to make it N+1"), the countdown, and a measurable reminder opt-in (a
 * recurring calendar event — works logged-out, no push infra, no permission
 * prompt).
 *
 * Integrity: renders streak/countdown copy only — never puzzle content.
 */
export function ReturnTomorrowCard({
  timeString,
  mode,
  currentStreak,
  className,
}: ReturnTomorrowCardProps) {
  const prefersReducedMotion = useReducedMotion();
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
    <motion.section
      aria-label="Come back tomorrow"
      className={cn(
        "from-primary/5 to-primary/10 border-primary/20 rounded-card w-full border bg-gradient-to-br p-6",
        className,
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{
        duration: msToSeconds(ANIMATION_DURATIONS.HINT_TRANSITION),
        delay: msToSeconds(ANIMATION_DURATIONS.PROXIMITY_DELAY),
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-body-primary text-lg font-bold">
            {streak > 0 ? (
              <>
                <span aria-hidden="true">🔥</span> {streak}-day streak
              </>
            ) : (
              "Come back tomorrow"
            )}
          </p>
          <p className="text-muted-foreground text-sm">
            {streak > 0
              ? `Win tomorrow's puzzle to make it ${streak + 1}.`
              : "Win tomorrow's puzzle to start a streak."}
          </p>
          <p className="text-muted-foreground mt-1 text-xs font-medium tracking-wide uppercase">
            New puzzle in{" "}
            <span className="text-body-primary font-mono text-sm font-bold normal-case">
              {timeString || "00:00:00"}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleReminderClick}
          className={cn(
            "border-primary/40 text-body-primary inline-flex min-h-11 items-center justify-center gap-2 rounded border-2 px-4 py-2 text-sm font-semibold",
            "hover:bg-primary/10 transition-colors duration-200 ease-out",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          <BellRinging className="size-4" aria-hidden="true" />
          Get a daily reminder
        </button>
      </div>
    </motion.section>
  );
}
