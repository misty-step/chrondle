import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Id } from "convex/_generated/dataModel";

import { useOrderGame } from "../useOrderGame";

vi.mock("../data/useOrderPuzzleData", () => ({
  useOrderPuzzleData: vi.fn(),
}));

vi.mock("../data/useAuthState", () => ({
  useAuthState: vi.fn(),
}));

vi.mock("../data/useOrderProgress", () => ({
  useOrderProgress: vi.fn(),
}));

vi.mock("../useOrderSession", () => ({
  useOrderSession: vi.fn(),
}));

vi.mock("../useMutationWithRetry", () => ({
  useMutationWithRetry: vi.fn(),
}));

import { useOrderPuzzleData } from "../data/useOrderPuzzleData";
import { useAuthState } from "../data/useAuthState";
import { useOrderProgress } from "../data/useOrderProgress";
import { useOrderSession } from "../useOrderSession";
import { useMutationWithRetry } from "../useMutationWithRetry";

describe("useOrderGame – authenticated submit", () => {
  const puzzleId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Id<"orderPuzzles">;
  const userId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const puzzle = {
    id: puzzleId,
    date: "2025-11-20",
    puzzleNumber: 123,
    seed: "seed",
    events: [
      { id: "event-1", year: 1900, text: "First event" },
      { id: "event-2", year: 1950, text: "Second event" },
    ],
  };

  const sessionState = {
    ordering: ["event-2", "event-1"],
    hints: [{ type: "anchor", eventId: "event-1", position: 0 }],
    committedAt: null,
    score: null,
  };

  const session = {
    state: sessionState,
    setOrdering: vi.fn(),
    addHint: vi.fn(),
    resetSession: vi.fn(),
    markCommitted: vi.fn(),
  };

  const submitOrderPlayMock = vi.fn().mockResolvedValue({ status: "recorded" });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useOrderPuzzleData).mockReturnValue({
      puzzle,
      isLoading: false,
      error: null,
    });

    vi.mocked(useAuthState).mockReturnValue({
      userId,
      isAuthenticated: true,
      isLoading: false,
    });

    vi.mocked(useOrderProgress).mockReturnValue({
      progress: null,
      isLoading: false,
    });

    vi.mocked(useOrderSession).mockReturnValue(session as never);
    vi.mocked(useMutationWithRetry).mockReturnValue(submitOrderPlayMock);
  });

  it("sends order play to Convex and marks session committed", async () => {
    const { result } = renderHook(() => useOrderGame());

    expect(result.current.gameState.status).toBe("ready");

    const score = {
      totalScore: 2,
      correctPairs: 1,
      totalPairs: 1,
      perfectPositions: 0,
      hintsUsed: 1,
    };

    await act(async () => {
      await result.current.commitOrdering(score);
    });

    expect(session.markCommitted).toHaveBeenCalledWith(score);
    expect(submitOrderPlayMock).toHaveBeenCalledTimes(1);
    expect(submitOrderPlayMock).toHaveBeenCalledWith({
      puzzleId,
      userId,
      ordering: sessionState.ordering,
      hints: ["anchor:event-1:0"],
      clientScore: { ...score, hintMultiplier: 1 },
    });
  });
});
