import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOrderSession } from "../useOrderSession";
import type { Id } from "convex/_generated/dataModel";
import type { PositionFeedback, OrderAttempt } from "@/types/orderGameState";
import * as helpers from "../lib/orderSessionHelpers";

// Mock the helper functions
vi.mock("../lib/orderSessionHelpers", () => ({
  ORDER_SESSION_PREFIX: "chrondle_order_session_v2_",
  SESSION_TTL_MS: 1000 * 60 * 60 * 24 * 30,
  readSession: vi.fn(),
  persistSession: vi.fn(),
  pruneStaleSessions: vi.fn(),
}));

describe("useOrderSession", () => {
  const mockPuzzleId = "order_puzzle_123" as Id<"orderPuzzles">;
  const baselineOrder = ["event_a", "event_b", "event_c", "event_d"];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Session Initialization", () => {
    it("should initialize with baseline order when no stored session", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      expect(result.current.state.ordering).toEqual(baselineOrder);
      expect(result.current.state.attempts).toEqual([]);
      expect(result.current.state.completedAt).toBeNull();
      expect(result.current.state.score).toBeNull();
    });

    it("should initialize from localStorage for anonymous users", () => {
      const storedSession: helpers.OrderSessionState = {
        ordering: ["event_d", "event_c", "event_b", "event_a"],
        attempts: [
          {
            ordering: ["event_a", "event_b", "event_c", "event_d"],
            feedback: ["incorrect", "incorrect", "incorrect", "incorrect"] as PositionFeedback[],
            pairsCorrect: 0,
            totalPairs: 6,
            timestamp: 123456,
          },
        ],
        completedAt: null,
        score: null,
      };
      vi.mocked(helpers.readSession).mockReturnValue(storedSession);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      expect(result.current.state.ordering).toEqual(storedSession.ordering);
      expect(result.current.state.attempts).toEqual(storedSession.attempts);
    });

    it("should use baseline order for authenticated users (ignore localStorage)", () => {
      const storedSession = {
        ordering: ["event_d", "event_c", "event_b", "event_a"],
        attempts: [],
        completedAt: null,
        score: null,
      };
      vi.mocked(helpers.readSession).mockReturnValue(storedSession);

      const { result } = renderHook(
        () => useOrderSession(mockPuzzleId, baselineOrder, true), // authenticated
      );

      // Should use baseline, not stored session
      expect(result.current.state.ordering).toEqual(baselineOrder);
    });

    it("should return default state when puzzleId is null", () => {
      const { result } = renderHook(() => useOrderSession(null, baselineOrder, false));

      expect(result.current.state.ordering).toEqual([]);
      expect(result.current.state.attempts).toEqual([]);
    });

    it("should prune stale sessions on mount for anonymous users", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      expect(helpers.pruneStaleSessions).toHaveBeenCalled();
    });

    it("should NOT prune sessions for authenticated users", () => {
      renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, true));

      expect(helpers.pruneStaleSessions).not.toHaveBeenCalled();
    });
  });

  describe("setOrdering", () => {
    it("should update ordering state", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      act(() => {
        result.current.setOrdering(["event_c", "event_a", "event_b", "event_d"]);
      });

      expect(result.current.state.ordering).toEqual(["event_c", "event_a", "event_b", "event_d"]);
    });

    it("should schedule debounced persist for anonymous users", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      act(() => {
        result.current.setOrdering(["event_c", "event_a", "event_b", "event_d"]);
      });

      // Should NOT persist immediately
      expect(helpers.persistSession).not.toHaveBeenCalled();

      // Advance past debounce (300ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(helpers.persistSession).toHaveBeenCalledWith(
        mockPuzzleId,
        expect.objectContaining({
          ordering: ["event_c", "event_a", "event_b", "event_d"],
        }),
      );
    });

    it("should NOT persist for authenticated users", () => {
      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, true));

      act(() => {
        result.current.setOrdering(["event_c", "event_a", "event_b", "event_d"]);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(helpers.persistSession).not.toHaveBeenCalled();
    });

    it("should debounce multiple rapid updates", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      // Rapid updates
      act(() => {
        result.current.setOrdering(["event_b", "event_a", "event_c", "event_d"]);
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.setOrdering(["event_c", "event_b", "event_a", "event_d"]);
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.setOrdering(["event_d", "event_c", "event_b", "event_a"]);
      });

      // Still waiting
      expect(helpers.persistSession).not.toHaveBeenCalled();

      // Complete debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should only persist final state once
      expect(helpers.persistSession).toHaveBeenCalledTimes(1);
      expect(helpers.persistSession).toHaveBeenCalledWith(
        mockPuzzleId,
        expect.objectContaining({
          ordering: ["event_d", "event_c", "event_b", "event_a"],
        }),
      );
    });
  });

  describe("addAttempt", () => {
    it("should append attempt to attempts array", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      const attempt: OrderAttempt = {
        ordering: baselineOrder,
        feedback: ["incorrect", "correct", "incorrect", "correct"] as PositionFeedback[],
        pairsCorrect: 2,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addAttempt(attempt);
      });

      expect(result.current.state.attempts).toHaveLength(1);
      expect(result.current.state.attempts[0]).toEqual(attempt);
    });

    it("should accumulate multiple attempts", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      const attempt1: OrderAttempt = {
        ordering: baselineOrder,
        feedback: ["incorrect", "incorrect", "incorrect", "incorrect"] as PositionFeedback[],
        pairsCorrect: 0,
        totalPairs: 6,
        timestamp: 100,
      };
      const attempt2: OrderAttempt = {
        ordering: ["event_b", "event_a", "event_c", "event_d"],
        feedback: ["incorrect", "incorrect", "correct", "correct"] as PositionFeedback[],
        pairsCorrect: 3,
        totalPairs: 6,
        timestamp: 200,
      };

      act(() => {
        result.current.addAttempt(attempt1);
      });
      act(() => {
        result.current.addAttempt(attempt2);
      });

      expect(result.current.state.attempts).toHaveLength(2);
      expect(result.current.state.attempts[0]).toEqual(attempt1);
      expect(result.current.state.attempts[1]).toEqual(attempt2);
    });
  });

  describe("markCompleted", () => {
    it("should set completedAt and score", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      const score = { attempts: 3 };

      act(() => {
        result.current.markCompleted(score);
      });

      expect(result.current.state.completedAt).toBe(Date.now());
      expect(result.current.state.score).toEqual(score);
    });
  });

  describe("resetSession", () => {
    it("should reset state to new ordering", () => {
      vi.mocked(helpers.readSession).mockReturnValue({
        ordering: ["event_d", "event_c", "event_b", "event_a"],
        attempts: [
          {
            ordering: baselineOrder,
            feedback: ["incorrect", "incorrect", "incorrect", "incorrect"],
            pairsCorrect: 0,
            totalPairs: 6,
            timestamp: 123,
          },
        ],
        completedAt: 456,
        score: { attempts: 1 },
      });

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      const newOrdering = ["event_a", "event_c", "event_b", "event_d"];

      act(() => {
        result.current.resetSession(newOrdering);
      });

      expect(result.current.state.ordering).toEqual(newOrdering);
      expect(result.current.state.attempts).toEqual([]);
      expect(result.current.state.completedAt).toBeNull();
      expect(result.current.state.score).toBeNull();
    });

    it("should immediately schedule persist", () => {
      vi.mocked(helpers.readSession).mockReturnValue(null);

      const { result } = renderHook(() => useOrderSession(mockPuzzleId, baselineOrder, false));

      act(() => {
        result.current.resetSession(baselineOrder);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(helpers.persistSession).toHaveBeenCalledWith(
        mockPuzzleId,
        expect.objectContaining({
          ordering: baselineOrder,
          attempts: [],
          completedAt: null,
          score: null,
        }),
      );
    });
  });

  describe("Puzzle ID Changes", () => {
    it("should reset to default state when puzzleId becomes null", () => {
      vi.mocked(helpers.readSession).mockReturnValue({
        ordering: ["event_d", "event_c", "event_b", "event_a"],
        attempts: [],
        completedAt: null,
        score: null,
      });

      const { result, rerender } = renderHook(
        ({ puzzleId }) => useOrderSession(puzzleId, baselineOrder, false),
        { initialProps: { puzzleId: mockPuzzleId as Id<"orderPuzzles"> | null } },
      );

      expect(result.current.state.ordering).toEqual(["event_d", "event_c", "event_b", "event_a"]);

      rerender({ puzzleId: null });

      expect(result.current.state.ordering).toEqual([]);
      expect(result.current.state.attempts).toEqual([]);
    });

    it("should reload session when puzzleId changes", () => {
      const puzzle1Session = {
        ordering: ["event_d", "event_c", "event_b", "event_a"],
        attempts: [],
        completedAt: null,
        score: null,
      };
      const puzzle2Session = {
        ordering: ["event_a", "event_d", "event_c", "event_b"],
        attempts: [],
        completedAt: null,
        score: null,
      };

      vi.mocked(helpers.readSession).mockImplementation((puzzleId) => {
        if (puzzleId === mockPuzzleId) return puzzle1Session;
        if (puzzleId === "order_puzzle_456") return puzzle2Session;
        return null;
      });

      const { result, rerender } = renderHook(
        ({ puzzleId }) => useOrderSession(puzzleId, baselineOrder, false),
        { initialProps: { puzzleId: mockPuzzleId as Id<"orderPuzzles"> } },
      );

      expect(result.current.state.ordering).toEqual(puzzle1Session.ordering);

      rerender({ puzzleId: "order_puzzle_456" as Id<"orderPuzzles"> });

      expect(result.current.state.ordering).toEqual(puzzle2Session.ordering);
    });
  });

  describe("Authentication Changes", () => {
    it("should reset to baseline when user becomes authenticated", () => {
      vi.mocked(helpers.readSession).mockReturnValue({
        ordering: ["event_d", "event_c", "event_b", "event_a"],
        attempts: [],
        completedAt: null,
        score: null,
      });

      const { result, rerender } = renderHook(
        ({ isAuthenticated }) => useOrderSession(mockPuzzleId, baselineOrder, isAuthenticated),
        { initialProps: { isAuthenticated: false } },
      );

      expect(result.current.state.ordering).toEqual(["event_d", "event_c", "event_b", "event_a"]);

      rerender({ isAuthenticated: true });

      expect(result.current.state.ordering).toEqual(baselineOrder);
    });
  });
});
