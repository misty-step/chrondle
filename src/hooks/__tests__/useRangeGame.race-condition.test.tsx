import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRangeGame } from "../useRangeGame";
import { Id } from "convex/_generated/dataModel";
import type { RangeGuess } from "@/types/range";

// Mock all dependencies
vi.mock("../data/usePuzzleData", () => ({
  usePuzzleData: vi.fn(),
}));

vi.mock("../data/useAuthState", () => ({
  useAuthState: vi.fn(),
}));

vi.mock("../data/useUserProgress", () => ({
  useUserProgress: vi.fn(),
}));

vi.mock("../data/useLocalSession", () => ({
  useLocalSession: vi.fn(),
}));

vi.mock("../actions/useGameActions", () => ({
  useGameActions: vi.fn(),
}));

import { usePuzzleData } from "../data/usePuzzleData";
import { useAuthState } from "../data/useAuthState";
import { useUserProgress } from "../data/useUserProgress";
import { useLocalSession } from "../data/useLocalSession";
import { useGameActions } from "../actions/useGameActions";

describe("useRangeGame Race Condition Tests", () => {
  const mockPuzzle = {
    id: "puzzle-1" as Id<"puzzles">,
    targetYear: 1969,
    events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
    puzzleNumber: 1,
  };

  const mockSession = {
    sessionGuesses: [],
    sessionRanges: [],
    addGuess: vi.fn(),
    clearGuesses: vi.fn(),
    markComplete: vi.fn(),
    addRange: vi.fn(),
    replaceLastRange: vi.fn(),
    removeLastRange: vi.fn(),
    clearRanges: vi.fn(),
  };

  const mockActions = {
    submitGuess: vi.fn(),
    submitRange: vi.fn(),
    resetGame: vi.fn(),
    isSubmitting: false,
  };

  const createProgressData = (
    overrides?: Partial<{
      guesses: number[];
      ranges: RangeGuess[];
      totalScore: number;
      completedAt: number | null;
    }>,
  ) => ({
    guesses: [],
    ranges: [],
    totalScore: 0,
    completedAt: null,
    ...(overrides || {}),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLocalSession).mockReturnValue(mockSession);
    vi.mocked(useGameActions).mockReturnValue(mockActions);
  });

  describe("Original Bug Scenario", () => {
    it("should show completed puzzle when progress loads after auth", async () => {
      // Step 1: Puzzle loads first
      vi.mocked(usePuzzleData).mockReturnValue({
        puzzle: mockPuzzle,
        isLoading: false,
        error: null,
      });
      vi.mocked(useAuthState).mockReturnValue({
        userId: null,
        isAuthenticated: false,
        isLoading: true,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: false,
      });

      const { result, rerender } = renderHook(() => useRangeGame());

      // Should be loading auth
      expect(result.current.gameState.status).toBe("loading-auth");

      // Step 2: Auth completes
      vi.mocked(useAuthState).mockReturnValue({
        userId: "j1234567890abcdef1234567890abcdef",
        isAuthenticated: true,
        isLoading: false,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: true,
      });

      rerender();

      // Should be loading progress
      expect(result.current.gameState.status).toBe("loading-progress");

      // Step 3: Progress loads with completed puzzle
      vi.mocked(useUserProgress).mockReturnValue({
        progress: createProgressData({
          guesses: [1950, 1960, 1969],
          completedAt: Date.now(),
        }),
        isLoading: false,
      });

      rerender();

      // Should show completed state!
      expect(result.current.gameState.status).toBe("ready");
      if (result.current.gameState.status === "ready") {
        expect(result.current.gameState.isComplete).toBe(true);
        expect(result.current.gameState.hasWon).toBe(true);
        expect(result.current.gameState.guesses).toEqual([1950, 1960, 1969]);
      }
    });
  });

  describe("Various Load Orders", () => {
    it("should handle auth → puzzle → progress order", () => {
      // Start with auth loaded
      vi.mocked(useAuthState).mockReturnValue({
        userId: "j1234567890abcdef1234567890abcdef",
        isAuthenticated: true,
        isLoading: false,
      });
      vi.mocked(usePuzzleData).mockReturnValue({
        puzzle: null,
        isLoading: true,
        error: null,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: false,
      });

      const { result, rerender } = renderHook(() => useRangeGame());

      // Should be loading puzzle (highest priority)
      expect(result.current.gameState.status).toBe("loading-puzzle");

      // Puzzle loads
      vi.mocked(usePuzzleData).mockReturnValue({
        puzzle: mockPuzzle,
        isLoading: false,
        error: null,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: true,
      });

      rerender();

      // Should be loading progress
      expect(result.current.gameState.status).toBe("loading-progress");

      // Progress loads
      vi.mocked(useUserProgress).mockReturnValue({
        progress: createProgressData({
          guesses: [1969],
          completedAt: Date.now(),
        }),
        isLoading: false,
      });

      rerender();

      // Should be ready and complete
      expect(result.current.gameState.status).toBe("ready");
      if (result.current.gameState.status === "ready") {
        expect(result.current.gameState.isComplete).toBe(true);
      }
    });

    it("should handle rapid sign in/out during loading", () => {
      vi.mocked(usePuzzleData).mockReturnValue({
        puzzle: mockPuzzle,
        isLoading: false,
        error: null,
      });

      // Start signed out
      vi.mocked(useAuthState).mockReturnValue({
        userId: null,
        isAuthenticated: false,
        isLoading: false,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: false,
      });

      const { result, rerender } = renderHook(() => useRangeGame());

      // Should be ready (anonymous)
      expect(result.current.gameState.status).toBe("ready");

      // Sign in (loading)
      vi.mocked(useAuthState).mockReturnValue({
        userId: null,
        isAuthenticated: false,
        isLoading: true,
      });

      rerender();

      // Should be loading auth
      expect(result.current.gameState.status).toBe("loading-auth");

      // Sign out before auth completes
      vi.mocked(useAuthState).mockReturnValue({
        userId: null,
        isAuthenticated: false,
        isLoading: false,
      });

      rerender();

      // Should be ready again (anonymous)
      expect(result.current.gameState.status).toBe("ready");
    });
  });

  describe("Session/Server State Merging", () => {
    it("should preserve session guesses when auth loads", () => {
      // Start with session guesses (anonymous)
      const sessionWithGuesses = {
        sessionGuesses: [1950, 1960],
        sessionRanges: [],
        addGuess: vi.fn(),
        clearGuesses: vi.fn(),
        markComplete: vi.fn(),
        addRange: vi.fn(),
        replaceLastRange: vi.fn(),
        removeLastRange: vi.fn(),
        clearRanges: vi.fn(),
      };
      vi.mocked(useLocalSession).mockReturnValue(sessionWithGuesses);

      vi.mocked(usePuzzleData).mockReturnValue({
        puzzle: mockPuzzle,
        isLoading: false,
        error: null,
      });
      vi.mocked(useAuthState).mockReturnValue({
        userId: null,
        isAuthenticated: false,
        isLoading: false,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: false,
      });

      const { result, rerender } = renderHook(() => useRangeGame());

      // Should have session guesses
      expect(result.current.gameState.status).toBe("ready");
      if (result.current.gameState.status === "ready") {
        expect(result.current.gameState.guesses).toEqual([1950, 1960]);
      }

      // User signs in and has server progress
      vi.mocked(useAuthState).mockReturnValue({
        userId: "j1234567890abcdef1234567890abcdef",
        isAuthenticated: true,
        isLoading: false,
      });
      vi.mocked(useUserProgress).mockReturnValue({
        progress: createProgressData({
          guesses: [1940], // Different server guesses
          completedAt: null,
        }),
        isLoading: false,
      });

      rerender();

      // Should merge server and session guesses
      expect(result.current.gameState.status).toBe("ready");
      if (result.current.gameState.status === "ready") {
        expect(result.current.gameState.guesses).toEqual([1940, 1950, 1960]);
      }
    });
  });

  describe("Slow Network Scenarios", () => {
    it("should handle slow progress loading gracefully", () => {
      vi.mocked(usePuzzleData).mockReturnValue({
        puzzle: mockPuzzle,
        isLoading: false,
        error: null,
      });
      vi.mocked(useAuthState).mockReturnValue({
        userId: "j1234567890abcdef1234567890abcdef",
        isAuthenticated: true,
        isLoading: false,
      });

      // Progress takes a long time to load
      vi.mocked(useUserProgress).mockReturnValue({
        progress: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useRangeGame());

      // Should show loading progress
      expect(result.current.gameState.status).toBe("loading-progress");

      // User shouldn't be blocked from seeing the puzzle
      // The UI can show a loading indicator for progress while displaying the puzzle
    });
  });

  describe("Deterministic State Derivation", () => {
    it("should always produce same state for same inputs", () => {
      const inputs = {
        puzzle: {
          puzzle: mockPuzzle,
          isLoading: false,
          error: null,
        },
        auth: {
          userId: "j1234567890abcdef1234567890abcdef",
          isAuthenticated: true,
          isLoading: false,
        },
        progress: {
          progress: createProgressData({
            guesses: [1969],
            completedAt: Date.now(),
          }),
          isLoading: false,
        },
        session: {
          sessionGuesses: [],
          sessionRanges: [],
          addGuess: vi.fn(),
          clearGuesses: vi.fn(),
          markComplete: vi.fn(),
          addRange: vi.fn(),
          replaceLastRange: vi.fn(),
          removeLastRange: vi.fn(),
          clearRanges: vi.fn(),
        },
      };

      vi.mocked(usePuzzleData).mockReturnValue(inputs.puzzle);
      vi.mocked(useAuthState).mockReturnValue(inputs.auth);
      vi.mocked(useUserProgress).mockReturnValue(inputs.progress);
      vi.mocked(useLocalSession).mockReturnValue(inputs.session);

      const { result: result1 } = renderHook(() => useRangeGame());
      const { result: result2 } = renderHook(() => useRangeGame());

      // Both hooks should produce identical state
      expect(result1.current.gameState).toEqual(result2.current.gameState);

      if (
        result1.current.gameState.status === "ready" &&
        result2.current.gameState.status === "ready"
      ) {
        expect(result1.current.gameState.isComplete).toBe(true);
        expect(result1.current.gameState.hasWon).toBe(true);
        expect(result2.current.gameState.isComplete).toBe(true);
        expect(result2.current.gameState.hasWon).toBe(true);
      }
    });
  });

  describe("All Possible Load Orders with Completed Progress", () => {
    const completedProgress = createProgressData({
      guesses: [1950, 1960, 1969],
      completedAt: Date.now(),
    });

    const testLoadOrder = (name: string, loadOrder: string[]) => {
      it(`should handle ${name} order`, () => {
        // Start with everything loading
        const states = {
          puzzle: {
            puzzle: null as typeof mockPuzzle | null,
            isLoading: true,
            error: null,
          },
          auth: {
            userId: null as string | null,
            isAuthenticated: false,
            isLoading: true,
          },
          progress: {
            progress: null as typeof completedProgress | null,
            isLoading: true,
          },
        };

        vi.mocked(usePuzzleData).mockReturnValue(states.puzzle);
        vi.mocked(useAuthState).mockReturnValue(states.auth);
        vi.mocked(useUserProgress).mockReturnValue(states.progress);

        const { result, rerender } = renderHook(() => useRangeGame());

        // Load components in specified order
        loadOrder.forEach((component) => {
          if (component === "puzzle") {
            states.puzzle = {
              puzzle: mockPuzzle,
              isLoading: false,
              error: null,
            };
          } else if (component === "auth") {
            states.auth = {
              userId: "j1234567890abcdef1234567890abcdef",
              isAuthenticated: true,
              isLoading: false,
            };
          } else if (component === "progress") {
            states.progress = {
              progress: completedProgress,
              isLoading: false,
            };
          }

          vi.mocked(usePuzzleData).mockReturnValue(states.puzzle);
          vi.mocked(useAuthState).mockReturnValue(states.auth);
          vi.mocked(useUserProgress).mockReturnValue(states.progress);
          rerender();
        });

        // Final state should always show completed puzzle
        expect(result.current.gameState.status).toBe("ready");
        if (result.current.gameState.status === "ready") {
          expect(result.current.gameState.isComplete).toBe(true);
          expect(result.current.gameState.hasWon).toBe(true);
          expect(result.current.gameState.guesses).toEqual([1950, 1960, 1969]);
        }
      });
    };

    testLoadOrder("puzzle → auth → progress", ["puzzle", "auth", "progress"]);
    testLoadOrder("puzzle → progress → auth", ["puzzle", "progress", "auth"]);
    testLoadOrder("auth → puzzle → progress", ["auth", "puzzle", "progress"]);
    testLoadOrder("auth → progress → puzzle", ["auth", "progress", "puzzle"]);
    testLoadOrder("progress → puzzle → auth", ["progress", "puzzle", "auth"]);
    testLoadOrder("progress → auth → puzzle", ["progress", "auth", "puzzle"]);
  });
});
