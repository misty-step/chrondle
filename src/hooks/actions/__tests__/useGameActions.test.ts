import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { useGameActions } from "../useGameActions";
import type { DataSources } from "@/lib/deriveGameState";
import type { RangeGuess } from "@/types/range";
import type { Id } from "convex/_generated/dataModel";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const mockSubmitGuessMutation = vi.hoisted(() => vi.fn());
const mockSubmitRangeMutation = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useMutationWithRetry", () => ({
  useMutationWithRetry: vi.fn(() => mockSubmitRangeMutation),
}));

const createDataSources = (): DataSources => {
  const puzzleId = "a".repeat(32) as Id<"puzzles">;
  const userId = "b".repeat(32);
  const ranges: RangeGuess[] = [];
  return {
    puzzle: {
      puzzle: {
        id: puzzleId,
        targetYear: 1969,
        events: [],
        puzzleNumber: 1,
      },
      isLoading: false,
      error: null,
    },
    auth: {
      userId,
      isAuthenticated: true,
      isLoading: false,
    },
    progress: {
      progress: null,
      isLoading: false,
    },
    session: {
      sessionGuesses: [],
      sessionRanges: ranges,
      addGuess: vi.fn(),
      clearGuesses: vi.fn(),
      addRange: vi.fn((range: RangeGuess) => ranges.push(range)),
      replaceLastRange: vi.fn(),
      removeLastRange: vi.fn(),
      clearRanges: vi.fn(() => ranges.splice(0, ranges.length)),
    },
  };
};

describe("useGameActions - submitRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitGuessMutation.mockReset();
    mockSubmitRangeMutation.mockReset();
  });

  it("optimistically adds range and reconciles with server score", async () => {
    const sources = createDataSources();
    mockSubmitRangeMutation.mockResolvedValue({
      range: {
        start: 1900,
        end: 1920,
        hintsUsed: 1,
        score: 555,
        timestamp: 123,
      },
    });

    const { result } = renderHook(() => useGameActions(sources));

    await act(async () => {
      await result.current.submitRange({ start: 1900, end: 1920, hintsUsed: 1 });
    });

    expect(mockSubmitRangeMutation).toHaveBeenCalledTimes(1);
    expect(sources.session.addRange).toHaveBeenCalledTimes(1);
    expect(sources.session.replaceLastRange).toHaveBeenCalledWith(
      expect.objectContaining({ score: 555 }),
    );
    expect(sources.session.removeLastRange).not.toHaveBeenCalled();
  });

  it("rolls back optimistic range when mutation fails", async () => {
    const sources = createDataSources();
    mockSubmitRangeMutation.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useGameActions(sources));

    await act(async () => {
      const success = await result.current.submitRange({ start: 1900, end: 1910, hintsUsed: 0 });
      expect(success).toBe(false);
    });

    expect(sources.session.addRange).toHaveBeenCalledTimes(1);
    expect(sources.session.removeLastRange).toHaveBeenCalledTimes(1);
  });
});
