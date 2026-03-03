/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameIsland } from "../GameIsland";

vi.mock("@/hooks/useRangeGame", () => ({
  useRangeGame: () => ({
    gameState: { status: "error", error: "Network timeout while loading puzzle" },
    submitRange: vi.fn(),
    resetGame: vi.fn(),
  }),
}));

vi.mock("@/types/gameState", () => ({
  isReady: () => false,
  getPuzzle: () => null,
}));

vi.mock("@/hooks/useStreak", () => ({
  useStreak: () => ({
    streakData: { currentStreak: 0 },
    updateStreak: vi.fn(),
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

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

describe("GameIsland error recovery", () => {
  it("shows retry action on recoverable load error", () => {
    render(<GameIsland />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
