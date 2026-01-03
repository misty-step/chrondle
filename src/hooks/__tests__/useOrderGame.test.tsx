import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOrderGame } from "../useOrderGame";
import type { Id } from "convex/_generated/dataModel";
import type { OrderPuzzle, OrderAttempt } from "@/types/orderGameState";
import type { MutationError } from "@/observability/mutationErrorAdapter";

// Mock all dependencies
vi.mock("../data/useAuthState", () => ({
  useAuthState: vi.fn(),
}));

vi.mock("../data/useOrderPuzzleData", () => ({
  useOrderPuzzleData: vi.fn(),
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

vi.mock("@/observability/mutationErrorAdapter", () => ({
  safeMutation: vi.fn(),
}));

vi.mock("@/lib/gameSubmission", () => ({
  checkSubmissionAuth: vi.fn(),
  handleSubmissionError: vi.fn(),
  logSubmissionAttempt: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  assertConvexId: vi.fn((id) => id),
}));

vi.mock("@/lib/order/attemptScoring", () => ({
  createAttempt: vi.fn(),
  calculateAttemptScore: vi.fn(),
  isSolved: vi.fn(),
}));

vi.mock("@/lib/deriveOrderGameState", () => ({
  deriveOrderGameState: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { useAuthState } from "../data/useAuthState";
import { useOrderPuzzleData } from "../data/useOrderPuzzleData";
import { useOrderProgress } from "../data/useOrderProgress";
import { useOrderSession } from "../useOrderSession";
import { useMutationWithRetry } from "../useMutationWithRetry";
import { safeMutation } from "@/observability/mutationErrorAdapter";
import { checkSubmissionAuth, handleSubmissionError } from "@/lib/gameSubmission";
import { createAttempt, calculateAttemptScore, isSolved } from "@/lib/order/attemptScoring";
import { deriveOrderGameState } from "@/lib/deriveOrderGameState";

describe("useOrderGame", () => {
  const mockPuzzleId = "order_puzzle_123" as Id<"orderPuzzles">;
  const mockUserId = "user_123";

  const mockPuzzle: OrderPuzzle = {
    id: mockPuzzleId,
    date: "2025-06-15",
    puzzleNumber: 42,
    events: [
      { id: "event_a", year: 1900, text: "Event A happened" },
      { id: "event_b", year: 1950, text: "Event B happened" },
      { id: "event_c", year: 2000, text: "Event C happened" },
      { id: "event_d", year: 2020, text: "Event D happened" },
    ],
    seed: "test-seed",
  };

  const mockSession = {
    state: {
      ordering: ["event_a", "event_b", "event_c", "event_d"],
      attempts: [],
      completedAt: null,
      score: null,
    },
    setOrdering: vi.fn(),
    addAttempt: vi.fn(),
    markCompleted: vi.fn(),
    resetSession: vi.fn(),
  };

  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useOrderPuzzleData).mockReturnValue({
      puzzle: mockPuzzle,
      isLoading: false,
      error: null,
    });

    vi.mocked(useAuthState).mockReturnValue({
      userId: null,
      isAuthenticated: false,
      isLoading: false,
    });

    vi.mocked(useOrderProgress).mockReturnValue({
      progress: null,
      isLoading: false,
    });

    vi.mocked(useOrderSession).mockReturnValue(mockSession);

    vi.mocked(useMutationWithRetry).mockReturnValue(mockMutate);

    // Default: ready state
    vi.mocked(deriveOrderGameState).mockReturnValue({
      status: "ready",
      puzzle: mockPuzzle,
      currentOrder: ["event_a", "event_b", "event_c", "event_d"],
      attempts: [],
    });
  });

  describe("Initial Load States", () => {
    it("should show loading-puzzle when puzzle is loading", () => {
      vi.mocked(deriveOrderGameState).mockReturnValue({
        status: "loading-puzzle",
      });

      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.gameState.status).toBe("loading-puzzle");
    });

    it("should show loading-auth when auth is loading", () => {
      vi.mocked(deriveOrderGameState).mockReturnValue({
        status: "loading-auth",
      });

      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.gameState.status).toBe("loading-auth");
    });

    it("should show loading-progress when authenticated and progress loading", () => {
      vi.mocked(deriveOrderGameState).mockReturnValue({
        status: "loading-progress",
      });

      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.gameState.status).toBe("loading-progress");
    });

    it("should show ready state when all data loaded", () => {
      // Uses default mock from beforeEach
      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.gameState.status).toBe("ready");
      if (result.current.gameState.status === "ready") {
        expect(result.current.gameState.puzzle).toEqual(mockPuzzle);
        expect(result.current.gameState.currentOrder).toEqual([
          "event_a",
          "event_b",
          "event_c",
          "event_d",
        ]);
      }
    });

    it("should show error state when puzzle fails to load", () => {
      vi.mocked(deriveOrderGameState).mockReturnValue({
        status: "error",
        error: "Failed to fetch puzzle",
      });

      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.gameState.status).toBe("error");
      if (result.current.gameState.status === "error") {
        expect(result.current.gameState.error).toBe("Failed to fetch puzzle");
      }
    });
  });

  describe("reorderEvents", () => {
    it("should call session.setOrdering with reordered array", () => {
      const { result } = renderHook(() => useOrderGame(42));

      act(() => {
        result.current.reorderEvents(0, 2);
      });

      expect(mockSession.setOrdering).toHaveBeenCalledWith([
        "event_b",
        "event_c",
        "event_a",
        "event_d",
      ]);
    });

    it("should not call setOrdering when indices are equal", () => {
      const { result } = renderHook(() => useOrderGame(42));

      act(() => {
        result.current.reorderEvents(1, 1);
      });

      expect(mockSession.setOrdering).not.toHaveBeenCalled();
    });

    it("should not call setOrdering for out-of-bounds indices", () => {
      const { result } = renderHook(() => useOrderGame(42));

      act(() => {
        result.current.reorderEvents(-1, 2);
      });

      expect(mockSession.setOrdering).not.toHaveBeenCalled();

      act(() => {
        result.current.reorderEvents(0, 10);
      });

      expect(mockSession.setOrdering).not.toHaveBeenCalled();
    });
  });

  describe("submitAttempt - Successful Submission Flow", () => {
    it("should create attempt and add to session on submit", async () => {
      const mockAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["incorrect", "incorrect", "incorrect", "incorrect"],
        pairsCorrect: 0,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      vi.mocked(createAttempt).mockReturnValue(mockAttempt);
      vi.mocked(isSolved).mockReturnValue(false);

      const { result } = renderHook(() => useOrderGame(42));

      let returnedAttempt: OrderAttempt | null = null;
      await act(async () => {
        returnedAttempt = await result.current.submitAttempt();
      });

      expect(createAttempt).toHaveBeenCalled();
      expect(mockSession.addAttempt).toHaveBeenCalledWith(mockAttempt);
      expect(returnedAttempt).toEqual(mockAttempt);
    });

    it("should persist to server when authenticated and solved", async () => {
      vi.mocked(useAuthState).mockReturnValue({
        userId: mockUserId,
        isAuthenticated: true,
        isLoading: false,
      });

      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });
      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
      });
      vi.mocked(safeMutation).mockResolvedValue([true, null]);

      const { result } = renderHook(() => useOrderGame(42));

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(mockSession.addAttempt).toHaveBeenCalledWith(solvedAttempt);
      expect(mockSession.markCompleted).toHaveBeenCalledWith({ attempts: 1 });
    });

    it("should mark completed for anonymous users without server call", async () => {
      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });
      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: false,
        isAnonymous: true,
        isAuthPending: false,
      });

      const { result } = renderHook(() => useOrderGame(42));

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(mockSession.addAttempt).toHaveBeenCalledWith(solvedAttempt);
      expect(mockSession.markCompleted).toHaveBeenCalledWith({ attempts: 1 });
      expect(safeMutation).not.toHaveBeenCalled();
    });
  });

  describe("submitAttempt - Failed Submission with Rollback", () => {
    it("should set lastError when server persistence fails", async () => {
      vi.mocked(useAuthState).mockReturnValue({
        userId: mockUserId,
        isAuthenticated: true,
        isLoading: false,
      });

      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      const mockError: MutationError = {
        code: "NETWORK",
        message: "Failed to save",
        retryable: true,
        originalError: new Error("Network failure"),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });
      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
      });
      vi.mocked(safeMutation).mockResolvedValue([null, mockError]);

      const mockAddToast = vi.fn();
      const { result } = renderHook(() => useOrderGame(42, undefined, mockAddToast));

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(result.current.lastError).toEqual(mockError);
      expect(mockSession.markCompleted).not.toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't save result",
          variant: "destructive",
        }),
      );
    });

    it("should show non-retryable message for non-retryable errors", async () => {
      vi.mocked(useAuthState).mockReturnValue({
        userId: mockUserId,
        isAuthenticated: true,
        isLoading: false,
      });

      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      const mockError: MutationError = {
        code: "VALIDATION",
        message: "Invalid data",
        retryable: false,
        originalError: new Error("Validation failed"),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });
      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
      });
      vi.mocked(safeMutation).mockResolvedValue([null, mockError]);

      const mockAddToast = vi.fn();
      const { result } = renderHook(() => useOrderGame(42, undefined, mockAddToast));

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("Something went wrong"),
        }),
      );
    });

    it("should clear error on new submission", async () => {
      vi.mocked(useAuthState).mockReturnValue({
        userId: mockUserId,
        isAuthenticated: true,
        isLoading: false,
      });

      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      const mockError: MutationError = {
        code: "NETWORK",
        message: "Failed to save",
        retryable: true,
        originalError: new Error("Network failure"),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });
      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
      });

      // First call fails
      vi.mocked(safeMutation).mockResolvedValueOnce([null, mockError]);

      const { result } = renderHook(() => useOrderGame(42));

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(result.current.lastError).toEqual(mockError);

      // Second call succeeds
      vi.mocked(safeMutation).mockResolvedValueOnce([true, null]);

      await act(async () => {
        await result.current.submitAttempt();
      });

      // Error should be cleared even before completion
      await waitFor(() => {
        expect(result.current.lastError).toBeNull();
      });
    });

    it("should allow clearError to manually clear error", async () => {
      vi.mocked(useAuthState).mockReturnValue({
        userId: mockUserId,
        isAuthenticated: true,
        isLoading: false,
      });

      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      const mockError: MutationError = {
        code: "NETWORK",
        message: "Failed to save",
        retryable: true,
        originalError: new Error("Network failure"),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });
      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: true,
        isAnonymous: false,
        isAuthPending: false,
      });
      vi.mocked(safeMutation).mockResolvedValue([null, mockError]);

      const { result } = renderHook(() => useOrderGame(42));

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(result.current.lastError).toEqual(mockError);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.lastError).toBeNull();
    });
  });

  describe("Double-Submission Prevention", () => {
    it("should start with isSubmitting false", () => {
      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.isSubmitting).toBe(false);
    });

    it("should return to isSubmitting false after submission completes", async () => {
      const mockAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["incorrect", "incorrect", "incorrect", "incorrect"],
        pairsCorrect: 0,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      vi.mocked(createAttempt).mockReturnValue(mockAttempt);
      vi.mocked(isSolved).mockReturnValue(false);

      const { result } = renderHook(() => useOrderGame(42));

      expect(result.current.isSubmitting).toBe(false);

      await act(async () => {
        await result.current.submitAttempt();
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it("should return null when puzzle is not loaded", async () => {
      vi.mocked(useOrderPuzzleData).mockReturnValue({
        puzzle: null,
        isLoading: false,
        error: null,
      });
      vi.mocked(deriveOrderGameState).mockReturnValue({
        status: "error",
        error: "No puzzle",
      });

      const { result } = renderHook(() => useOrderGame(42));

      let submitResult: OrderAttempt | null = null;
      await act(async () => {
        submitResult = await result.current.submitAttempt();
      });

      expect(submitResult).toBeNull();
    });
  });

  describe("Auth Check Failures", () => {
    it("should handle auth check errors", async () => {
      const mockAuthError = {
        code: "AUTH_PENDING" as const,
        message: "Not authenticated",
        shouldAlert: true,
        retryable: false,
      };

      const mockMutationError: MutationError = {
        code: "AUTH",
        message: "Not authenticated",
        retryable: false,
        originalError: new Error("Auth failed"),
      };

      vi.mocked(checkSubmissionAuth).mockReturnValue({
        canPersist: false,
        isAnonymous: false,
        isAuthPending: true,
        error: mockAuthError,
      });
      vi.mocked(handleSubmissionError).mockReturnValue([null, mockMutationError]);

      const solvedAttempt: OrderAttempt = {
        ordering: ["event_a", "event_b", "event_c", "event_d"],
        feedback: ["correct", "correct", "correct", "correct"],
        pairsCorrect: 6,
        totalPairs: 6,
        timestamp: Date.now(),
      };

      vi.mocked(createAttempt).mockReturnValue(solvedAttempt);
      vi.mocked(isSolved).mockReturnValue(true);
      vi.mocked(calculateAttemptScore).mockReturnValue({ attempts: 1 });

      const { result } = renderHook(() => useOrderGame(42));

      await act(async () => {
        await result.current.submitAttempt();
      });

      // Should NOT mark completed when auth fails
      expect(mockSession.markCompleted).not.toHaveBeenCalled();
    });
  });
});
