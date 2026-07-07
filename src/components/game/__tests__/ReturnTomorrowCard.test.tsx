import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ReturnTomorrowCard } from "../ReturnTomorrowCard";
import { useStreak } from "@/hooks/useStreak";
import { analytics, AnalyticsEvent } from "@/lib/analytics";
import { downloadDailyReminder } from "@/lib/reminder";

vi.mock("motion/react", () => ({
  motion: {
    section: ({
      children,
      ...props
    }: React.ComponentProps<"section"> & Record<string, unknown>) => {
      const { initial, animate, transition, ...rest } = props;
      void initial;
      void animate;
      void transition;
      return <section {...(rest as React.ComponentProps<"section">)}>{children}</section>;
    },
  },
  useReducedMotion: () => true,
}));

vi.mock("@/hooks/useStreak", () => ({
  useStreak: vi.fn(),
}));

vi.mock("@/lib/reminder", () => ({
  downloadDailyReminder: vi.fn(),
}));

function mockStreak(currentStreak: number) {
  vi.mocked(useStreak).mockReturnValue({
    streakData: {
      currentStreak,
      longestStreak: currentStreak,
      totalGamesPlayed: 0,
      lastPlayedDate: "",
      playedDates: [],
      achievements: [],
    },
    updateStreak: vi.fn(),
    hasNewAchievement: false,
    newAchievement: null,
    clearNewAchievement: vi.fn(),
  });
}

describe("ReturnTomorrowCard", () => {
  let trackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    trackSpy = vi.spyOn(analytics, "track").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("frames the streak stake as make-it-N+1 for an active streak", () => {
    mockStreak(4);
    render(<ReturnTomorrowCard timeString="02:39:04" mode="classic" />);

    expect(screen.getByText(/4-day streak/)).toBeInTheDocument();
    expect(screen.getByText(/win tomorrow's puzzle to make it 5/i)).toBeInTheDocument();
    expect(screen.getByText("02:39:04")).toBeInTheDocument();
  });

  it("invites a fresh start when there is no streak", () => {
    mockStreak(0);
    render(<ReturnTomorrowCard timeString="10:00:00" mode="classic" />);

    expect(screen.getByText(/come back tomorrow/i)).toBeInTheDocument();
    expect(screen.getByText(/win tomorrow's puzzle to start a streak/i)).toBeInTheDocument();
  });

  it("tracks the view once and the reminder opt-in on tap", () => {
    mockStreak(2);
    render(<ReturnTomorrowCard timeString="01:00:00" mode="order" />);

    expect(trackSpy).toHaveBeenCalledWith(AnalyticsEvent.RETURN_HOOK_SHOWN, {
      mode: "order",
      streak: 2,
    });

    fireEvent.click(screen.getByRole("button", { name: /get a daily reminder/i }));

    expect(trackSpy).toHaveBeenCalledWith(AnalyticsEvent.REMINDER_OPTIN, {
      mode: "order",
      streak: 2,
    });
    expect(downloadDailyReminder).toHaveBeenCalledTimes(1);
  });

  it("prefers the live streak prop over its own (possibly stale) hook instance", () => {
    mockStreak(0); // stale instance value from pre-completion storage
    render(<ReturnTomorrowCard timeString="02:00:00" mode="classic" currentStreak={1} />);

    expect(screen.getByText(/1-day streak/)).toBeInTheDocument();
    expect(screen.getByText(/win tomorrow's puzzle to make it 2/i)).toBeInTheDocument();
    expect(trackSpy).toHaveBeenCalledWith(AnalyticsEvent.RETURN_HOOK_SHOWN, {
      mode: "classic",
      streak: 1,
    });
  });

  it("never renders puzzle content (era/year integrity)", () => {
    mockStreak(7);
    const { container } = render(<ReturnTomorrowCard timeString="03:00:00" mode="classic" />);

    expect(container.textContent).not.toMatch(/\b\d{1,4}\s?(BC|AD)\b/);
  });
});
