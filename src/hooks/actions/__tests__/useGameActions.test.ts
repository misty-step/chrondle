import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { useGameActions } from "../useGameActions";
import { useMutationWithRetry } from "@/hooks/useMutationWithRetry";
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

describe("useGameActions - submitGuess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitGuessMutation.mockReset();
    mockSubmitRangeMutation.mockReset();
    vi.mocked(useMutationWithRetry)
      .mockReturnValueOnce(mockSubmitGuessMutation)
      .mockReturnValue(mockSubmitRangeMutation);
  });

  it("optimistically adds guess and returns true on successful server call (authenticated)", async () => {
    const sources = createDataSources();
    mockSubmitGuessMutation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    expect(sources.session.addGuess).toHaveBeenCalledWith(1969);
    expect(mockSubmitGuessMutation).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe(true);
  });

  it("adds guess locally and returns true without server call (anonymous user)", async () => {
    const sources = createDataSources();
    sources.auth.isAuthenticated = false;
    sources.auth.userId = null;

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    expect(sources.session.addGuess).toHaveBeenCalledWith(1969);
    expect(mockSubmitGuessMutation).not.toHaveBeenCalled();
    expect(returnValue).toBe(true);
  });

  it("returns false and skips addGuess when no puzzle is loaded", async () => {
    const sources = createDataSources();
    sources.puzzle.puzzle = null;

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    expect(sources.session.addGuess).not.toHaveBeenCalled();
    expect(returnValue).toBe(false);
  });

  it("returns false and skips addGuess on out-of-bounds year (validation failure)", async () => {
    const sources = createDataSources();

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(99999);
    });

    expect(sources.session.addGuess).not.toHaveBeenCalled();
    expect(returnValue).toBe(false);
  });

  it("returns false and skips addGuess when all 6 guesses are exhausted", async () => {
    const sources = createDataSources();
    sources.session.sessionGuesses = Array(6).fill(1969) as number[];

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    expect(sources.session.addGuess).not.toHaveBeenCalled();
    expect(returnValue).toBe(false);
  });

  it("returns false after optimistic addGuess when authenticated but userId is null (auth edge case)", async () => {
    const sources = createDataSources();
    sources.auth.isAuthenticated = true;
    sources.auth.userId = null;

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    // Optimistic update fires before auth check; no rollback on this path
    expect(sources.session.addGuess).toHaveBeenCalledWith(1969);
    expect(returnValue).toBe(false);
  });

  it("returns true and keeps optimistic guess when server call fails with generic error", async () => {
    const sources = createDataSources();
    mockSubmitGuessMutation.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    expect(sources.session.addGuess).toHaveBeenCalledWith(1969);
    expect(mockSubmitGuessMutation).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe(true);
  });

  it("returns true and keeps optimistic guess when server call fails with ConvexId validation error", async () => {
    const sources = createDataSources();
    const { ConvexIdValidationError } = await import("@/lib/validation");
    mockSubmitGuessMutation.mockRejectedValue(
      new ConvexIdValidationError("Invalid puzzles ID format", "bad-id", "puzzles"),
    );

    const { result } = renderHook(() => useGameActions(sources));

    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.submitGuess(1969);
    });

    expect(sources.session.addGuess).toHaveBeenCalledWith(1969);
    expect(mockSubmitGuessMutation).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe(true);
  });
});
