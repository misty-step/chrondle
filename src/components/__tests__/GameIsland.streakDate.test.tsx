/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameIsland } from "../GameIsland";

// Real path under test: GameIsland → useRangeGame → usePuzzleData →
// deriveGameState. Only the data sources below the daily puzzle are stubbed.

const updateStreak = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/hooks/useTodaysPuzzle", () => ({
  useTodaysPuzzle: () => ({
    puzzle: {
      id: "puzzle_1018",
      targetYear: 1969,
      events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
      puzzleNumber: 300,
      date: "2026-10-18",
    },
    isLoading: false,
    error: null,
    currentDate: "2026-10-19",
    revalidate: vi.fn(),
  }),
}));

vi.mock("@/hooks/data/useAuthState", () => ({
  useAuthState: () => ({ userId: null, isAuthenticated: false, isLoading: false }),
}));

vi.mock("@/hooks/data/useUserProgress", () => ({
  useUserProgress: () => ({ progress: null, isLoading: false }),
}));

// A won session: one submitted range that scored.
const sessionRanges = [{ start: 1960, end: 1980, hintsUsed: 0, score: 80, timestamp: 1 }];
vi.mock("@/hooks/data/useLocalSession", () => ({
  useLocalSession: () => ({
    sessionGuesses: [],
    sessionRanges,
    addGuess: vi.fn(),
    clearGuesses: vi.fn(),
  }),
}));

vi.mock("@/hooks/actions/useGameActions", () => ({
  useGameActions: () => ({ submitRange: vi.fn(), resetGame: vi.fn(), isSubmitting: false }),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: vi.fn(),
  usePerformanceTracking: () => ({ measureDerivation: (fn: () => unknown) => fn() }),
}));

vi.mock("@/hooks/useStreak", () => ({
  useStreak: () => ({
    streakData: { currentStreak: 0 },
    updateStreak,
    hasNewAchievement: false,
    newAchievement: null,
    clearNewAchievement: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCountdown", () => ({
  useCountdown: () => ({ hours: 0, minutes: 0, seconds: 0, isExpired: false }),
}));

vi.mock("@/hooks/useVictoryConfetti", () => ({
  useVictoryConfetti: vi.fn(),
}));

vi.mock("@/hooks/useScreenReaderAnnouncements", () => ({
  useScreenReaderAnnouncements: () => "",
}));

vi.mock("@/components/LazyModals", () => ({
  AchievementModal: () => <div />,
  LazyModalWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/LazyComponents", () => ({
  GameLayout: () => <div />,
  LiveAnnouncer: () => <div />,
}));

vi.mock("@/components/GameModeLayout", () => ({
  GameModeLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("GameIsland streak dating", () => {
  it("dates a daily completion by the puzzle's date, not the clock", async () => {
    render(<GameIsland />);

    await waitFor(() => expect(updateStreak).toHaveBeenCalledTimes(1));
    expect(updateStreak).toHaveBeenCalledWith(true, "2026-10-18");
  });
});
