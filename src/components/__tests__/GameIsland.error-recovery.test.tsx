/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND_UNREACHABLE_ERROR } from "@/lib/errorRecovery";
import { GameIsland } from "../GameIsland";

let mockLoadError = "Network timeout while loading puzzle";

vi.mock("@/hooks/useRangeGame", () => ({
  useRangeGame: () => ({
    gameState: { status: "error", error: mockLoadError },
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
  beforeEach(() => {
    mockLoadError = "Network timeout while loading puzzle";
  });

  it("shows retry action on recoverable load error", () => {
    render(<GameIsland />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("tells the player the server is unreachable and offers a reload", () => {
    mockLoadError = BACKEND_UNREACHABLE_ERROR;

    render(<GameIsland />);

    expect(screen.getByRole("status")).toHaveTextContent(/can.t reach the Chrondle server/i);
    expect(screen.getByRole("button", { name: /reload|retry/i })).toBeInTheDocument();
  });
});
