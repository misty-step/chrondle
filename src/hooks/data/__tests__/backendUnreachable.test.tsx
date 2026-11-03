import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePuzzleData } from "../usePuzzleData";
import { useOrderPuzzleData } from "../useOrderPuzzleData";
import {
  BACKEND_UNREACHABLE_ERROR,
  BACKEND_UNREACHABLE_TIMEOUT_MS,
  PUZZLE_UNAVAILABLE_ERROR,
} from "@/lib/errorRecovery";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn(() => Promise.resolve())),
}));

import { useMutation, useQuery } from "convex/react";

const classicPuzzle = {
  _id: "puzzle-1",
  targetYear: 1969,
  events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
  puzzleNumber: 1,
};

const orderPuzzle = {
  _id: "order-1",
  date: "2026-10-20",
  puzzleNumber: 1,
  events: [{ id: "a", year: 1900, text: "Event A" }],
  seed: "seed",
};

describe("backend unreachable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useQuery).mockReturnValue(undefined);
    vi.mocked(useMutation).mockReturnValue(
      vi.fn(() => Promise.resolve()) as unknown as ReturnType<typeof useMutation>,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps loading before the timeout", () => {
    const { result } = renderHook(() => usePuzzleData());

    act(() => {
      vi.advanceTimersByTime(BACKEND_UNREACHABLE_TIMEOUT_MS - 1);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("turns a stalled daily load into a can't-reach-server error", () => {
    const { result } = renderHook(() => usePuzzleData());

    act(() => {
      vi.advanceTimersByTime(BACKEND_UNREACHABLE_TIMEOUT_MS);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toBe(BACKEND_UNREACHABLE_ERROR);
    expect(BACKEND_UNREACHABLE_ERROR).toMatch(/can.?t reach/i);
  });

  it("turns a stalled archive load into the same error", () => {
    const { result } = renderHook(() => usePuzzleData(42));

    act(() => {
      vi.advanceTimersByTime(BACKEND_UNREACHABLE_TIMEOUT_MS);
    });

    expect(result.current.error?.message).toBe(BACKEND_UNREACHABLE_ERROR);
  });

  it("recovers on its own when the puzzle arrives after the timeout", () => {
    const { result, rerender } = renderHook(() => usePuzzleData());

    act(() => {
      vi.advanceTimersByTime(BACKEND_UNREACHABLE_TIMEOUT_MS);
    });
    expect(result.current.error).not.toBeNull();

    vi.mocked(useQuery).mockReturnValue(classicPuzzle);
    rerender();

    expect(result.current.error).toBeNull();
    expect(result.current.puzzle?.puzzleNumber).toBe(1);
  });

  it("turns a stalled daily Order load into the same error", () => {
    const { result } = renderHook(() => useOrderPuzzleData());

    act(() => {
      vi.advanceTimersByTime(BACKEND_UNREACHABLE_TIMEOUT_MS);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toBe(BACKEND_UNREACHABLE_ERROR);
  });

  it("never times out an Order puzzle already seeded by the server", () => {
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    const { result } = renderHook(() => useOrderPuzzleData(undefined, orderPuzzle));

    act(() => {
      vi.advanceTimersByTime(BACKEND_UNREACHABLE_TIMEOUT_MS * 2);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.puzzle?.puzzleNumber).toBe(1);
  });

  describe("when the server answers but cannot create today's puzzle", () => {
    beforeEach(() => {
      // The query reaches the server and reports no puzzle; the ensure mutation rejects
      // (e.g. device clock outside the allowed window).
      vi.mocked(useQuery).mockReturnValue(null);
      const rejectingEnsure = vi.fn(() => Promise.reject(new Error("Date out of allowed window")));
      vi.mocked(useMutation).mockReturnValue(
        rejectingEnsure as unknown as ReturnType<typeof useMutation>,
      );
    });

    it("reports the classic puzzle as unavailable instead of blaming the connection", async () => {
      const { result } = renderHook(() => usePuzzleData());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BACKEND_UNREACHABLE_TIMEOUT_MS);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toBe(PUZZLE_UNAVAILABLE_ERROR);
    });

    it("reports the Order puzzle as unavailable instead of blaming the connection", async () => {
      const { result } = renderHook(() => useOrderPuzzleData());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BACKEND_UNREACHABLE_TIMEOUT_MS);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toBe(PUZZLE_UNAVAILABLE_ERROR);
    });
  });
});
