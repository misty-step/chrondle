/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GameIsland } from "../GameIsland";
import type { GameState, ReadyState } from "@/types/gameState";
import { logger } from "@/lib/logger";
import { assertConvexId } from "@/lib/validation";
const commits = vi.hoisted(() => ({ latest: Promise.resolve(false) }));
vi.mock("@/observability/reporter", () => ({ captureClientException: vi.fn() }));
let state: GameState = { status: "loading-puzzle" };
const updateStreak = vi.fn();
const submit = vi.fn(async () => true);
const ready: ReadyState = {
  status: "ready",
  puzzle: {
    id: assertConvexId("a".repeat(32), "puzzles"),
    targetYear: 2000,
    events: [],
    puzzleNumber: 42,
  },
  guesses: [],
  ranges: [{ start: 1990, end: 2010, score: 84, hintsUsed: 1, timestamp: 1000 }],
  totalScore: 84,
  isComplete: true,
  hasWon: true,
  remainingGuesses: 6,
  remainingAttempts: 5,
  hintsRevealed: 1,
};

vi.mock("@/hooks/useRangeGame", () => ({
  useRangeGame: () => ({
    gameState: state,
    submitRange: submit,
    resetGame: vi.fn(),
  }),
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
  GameLayout: ({
    onRangeCommit,
  }: {
    onRangeCommit: (input: { start: number; end: number; hintsUsed: number }) => Promise<boolean>;
  }) => (
    <button
      onClick={() => {
        commits.latest = onRangeCommit({ start: 1990, end: 2010, hintsUsed: 1 });
      }}
    >
      Submit fixture range
    </button>
  ),
  LiveAnnouncer: () => <div />,
}));

vi.mock("@/components/GameModeLayout", () => ({
  GameModeLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

describe("GameIsland restored completion", () => {
  beforeEach(() => {
    state = { status: "loading-puzzle" };
    vi.clearAllMocks();
  });
  it("does not award on loading-to-completed restore, rerender or remount", () => {
    const view = render(<GameIsland />);
    state = ready;
    view.rerender(<GameIsland />);
    view.rerender(<GameIsland />);
    view.unmount();
    render(<GameIsland />);
    expect(updateStreak).not.toHaveBeenCalled();
  });
  it("awards only an accepted submission made in this tab", async () => {
    state = { ...ready, isComplete: false, hasWon: false, ranges: [] };
    render(<GameIsland />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit fixture range" }));
    });
    expect(updateStreak).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("does not award a rejected submission", async () => {
    submit.mockResolvedValueOnce(false);
    state = { ...ready, isComplete: false, hasWon: false, ranges: [] };
    render(<GameIsland />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit fixture range" }));
    });
    expect(updateStreak).not.toHaveBeenCalled();
  });
  it("returns accepted and awards once when completion logging throws", async () => {
    state = { ...ready, isComplete: false, hasWon: false, ranges: [] };
    vi.mocked(logger.info).mockImplementationOnce(() => {
      throw new Error("logging failed");
    });
    render(<GameIsland />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit fixture range" }));
      await expect(commits.latest).resolves.toBe(true);
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(updateStreak).toHaveBeenCalledExactlyOnceWith(true);
  });
});
