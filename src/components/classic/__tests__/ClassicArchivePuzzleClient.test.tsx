import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/types/gameState";
import { ClassicArchivePuzzleClient } from "../ClassicArchivePuzzleClient";

let mockGameState: GameState = { status: "loading-puzzle" };

vi.mock("@/hooks/useRangeGame", () => ({
  useRangeGame: () => ({
    gameState: mockGameState,
    submitRange: vi.fn(),
    resetGame: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/puzzleData", () => ({
  fetchTotalPuzzles: () => Promise.resolve(434),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("@/hooks/useVictoryConfetti", () => ({
  useVictoryConfetti: vi.fn(),
}));

vi.mock("@/hooks/useScreenReaderAnnouncements", () => ({
  useScreenReaderAnnouncements: () => "",
}));

vi.mock("@/components/GameLayout", () => ({
  GameLayout: () => <div data-testid="game-layout" />,
}));

vi.mock("@/components/AppHeader", () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));

vi.mock("@/components/Footer", () => ({
  Footer: () => <div data-testid="footer" />,
}));

vi.mock("@/components/kit/LiveAnnouncer", () => ({
  LiveAnnouncer: () => null,
}));

describe("ClassicArchivePuzzleClient", () => {
  beforeEach(() => {
    mockGameState = { status: "loading-puzzle" };
  });

  it("shows the loading view while the puzzle loads", () => {
    render(<ClassicArchivePuzzleClient puzzleNumber={12} />);

    expect(screen.getByText(/Loading puzzle/i)).toBeInTheDocument();
  });

  it("shows a not-found state with a way back when the puzzle does not exist", () => {
    mockGameState = { status: "error", error: "Puzzle #999999 not found" };

    render(<ClassicArchivePuzzleClient puzzleNumber={999999} />);

    expect(screen.queryByText(/Loading puzzle/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Puzzle #999999 doesn.t exist/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /archive/i })).toHaveAttribute("href", "/archive");
    expect(screen.queryByTestId("game-layout")).not.toBeInTheDocument();
  });

  it("shows other load failures with a retry instead of spinning", () => {
    mockGameState = { status: "error", error: "Failed to derive game state" };

    render(<ClassicArchivePuzzleClient puzzleNumber={12} />);

    expect(screen.queryByText(/Loading puzzle/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /couldn.t load puzzle #12/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /archive/i })).toHaveAttribute("href", "/archive");
  });
});
