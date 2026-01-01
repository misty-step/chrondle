import { describe, it, expect } from "vitest";
import type { Puzzle } from "../puzzle";
import type { RangeGuess } from "../range";
import {
  isLoadingPuzzle,
  isLoadingAuth,
  isLoadingProgress,
  isReady,
  isError,
  isLoading,
  getLoadingMessage,
  type GameState,
  type LoadingPuzzleState,
  type LoadingAuthState,
  type LoadingProgressState,
  type ReadyState,
  type ErrorState,
} from "../gameState";

// Test fixtures
const mockPuzzle: Puzzle = {
  id: "test-puzzle-id" as unknown as Puzzle["id"],
  targetYear: 1969,
  events: ["Moon landing", "Woodstock", "Abbey Road", "ARPANET", "Concorde", "Sesame Street"],
  puzzleNumber: 1,
};

const mockRange: RangeGuess = {
  start: 1960,
  end: 1980,
  hintsUsed: 0,
  score: 50,
  timestamp: Date.now(),
};

const loadingPuzzleState: LoadingPuzzleState = {
  status: "loading-puzzle",
};

const loadingAuthState: LoadingAuthState = {
  status: "loading-auth",
  puzzle: mockPuzzle, // Puzzle is available during auth loading
};

const loadingProgressState: LoadingProgressState = {
  status: "loading-progress",
  puzzle: mockPuzzle, // Puzzle is available during progress loading
};

const readyState: ReadyState = {
  status: "ready",
  puzzle: mockPuzzle,
  guesses: [1970, 1968],
  ranges: [mockRange],
  totalScore: 50,
  isComplete: false,
  hasWon: false,
  remainingGuesses: 4,
  remainingAttempts: 4,
  hintsRevealed: 2,
};

const errorState: ErrorState = {
  status: "error",
  error: "Failed to load puzzle",
};

describe("gameState type guards", () => {
  describe("isLoadingPuzzle", () => {
    it("returns true for loading-puzzle state", () => {
      expect(isLoadingPuzzle(loadingPuzzleState)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isLoadingPuzzle(loadingAuthState)).toBe(false);
      expect(isLoadingPuzzle(loadingProgressState)).toBe(false);
      expect(isLoadingPuzzle(readyState)).toBe(false);
      expect(isLoadingPuzzle(errorState)).toBe(false);
    });

    it("narrows type correctly", () => {
      const state: GameState = loadingPuzzleState;
      if (isLoadingPuzzle(state)) {
        // TypeScript should narrow to LoadingPuzzleState
        expect(state.status).toBe("loading-puzzle");
      }
    });
  });

  describe("isLoadingAuth", () => {
    it("returns true for loading-auth state", () => {
      expect(isLoadingAuth(loadingAuthState)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isLoadingAuth(loadingPuzzleState)).toBe(false);
      expect(isLoadingAuth(loadingProgressState)).toBe(false);
      expect(isLoadingAuth(readyState)).toBe(false);
      expect(isLoadingAuth(errorState)).toBe(false);
    });

    it("narrows type correctly", () => {
      const state: GameState = loadingAuthState;
      if (isLoadingAuth(state)) {
        expect(state.status).toBe("loading-auth");
      }
    });
  });

  describe("isLoadingProgress", () => {
    it("returns true for loading-progress state", () => {
      expect(isLoadingProgress(loadingProgressState)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isLoadingProgress(loadingPuzzleState)).toBe(false);
      expect(isLoadingProgress(loadingAuthState)).toBe(false);
      expect(isLoadingProgress(readyState)).toBe(false);
      expect(isLoadingProgress(errorState)).toBe(false);
    });

    it("narrows type correctly", () => {
      const state: GameState = loadingProgressState;
      if (isLoadingProgress(state)) {
        expect(state.status).toBe("loading-progress");
      }
    });
  });

  describe("isReady", () => {
    it("returns true for ready state", () => {
      expect(isReady(readyState)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isReady(loadingPuzzleState)).toBe(false);
      expect(isReady(loadingAuthState)).toBe(false);
      expect(isReady(loadingProgressState)).toBe(false);
      expect(isReady(errorState)).toBe(false);
    });

    it("narrows type correctly with full property access", () => {
      const state: GameState = readyState;
      if (isReady(state)) {
        // TypeScript should narrow to ReadyState
        expect(state.puzzle).toBeDefined();
        expect(state.guesses).toHaveLength(2);
        expect(state.ranges).toHaveLength(1);
        expect(state.totalScore).toBe(50);
        expect(state.isComplete).toBe(false);
        expect(state.hasWon).toBe(false);
        expect(state.remainingGuesses).toBe(4);
        expect(state.remainingAttempts).toBe(4);
        expect(state.hintsRevealed).toBe(2);
      }
    });
  });

  describe("isError", () => {
    it("returns true for error state", () => {
      expect(isError(errorState)).toBe(true);
    });

    it("returns false for other states", () => {
      expect(isError(loadingPuzzleState)).toBe(false);
      expect(isError(loadingAuthState)).toBe(false);
      expect(isError(loadingProgressState)).toBe(false);
      expect(isError(readyState)).toBe(false);
    });

    it("narrows type correctly with error access", () => {
      const state: GameState = errorState;
      if (isError(state)) {
        expect(state.error).toBe("Failed to load puzzle");
      }
    });
  });

  describe("isLoading", () => {
    it("returns true for all loading states", () => {
      expect(isLoading(loadingPuzzleState)).toBe(true);
      expect(isLoading(loadingAuthState)).toBe(true);
      expect(isLoading(loadingProgressState)).toBe(true);
    });

    it("returns false for non-loading states", () => {
      expect(isLoading(readyState)).toBe(false);
      expect(isLoading(errorState)).toBe(false);
    });
  });

  describe("getLoadingMessage", () => {
    it("returns appropriate message for loading-puzzle", () => {
      expect(getLoadingMessage(loadingPuzzleState)).toBe("Loading puzzle...");
    });

    it("returns appropriate message for loading-auth", () => {
      expect(getLoadingMessage(loadingAuthState)).toBe("Checking authentication...");
    });

    it("returns appropriate message for loading-progress", () => {
      expect(getLoadingMessage(loadingProgressState)).toBe("Loading your progress...");
    });

    it("returns null for ready state", () => {
      expect(getLoadingMessage(readyState)).toBeNull();
    });

    it("returns null for error state", () => {
      expect(getLoadingMessage(errorState)).toBeNull();
    });
  });
});

describe("gameState edge cases", () => {
  it("handles ready state with empty guesses and ranges", () => {
    const emptyReadyState: ReadyState = {
      status: "ready",
      puzzle: mockPuzzle,
      guesses: [],
      ranges: [],
      totalScore: 0,
      isComplete: false,
      hasWon: false,
      remainingGuesses: 6,
      remainingAttempts: 6,
      hintsRevealed: 0,
    };

    expect(isReady(emptyReadyState)).toBe(true);
  });

  it("handles ready state with completed game", () => {
    const completedState: ReadyState = {
      ...readyState,
      isComplete: true,
      hasWon: true,
      remainingGuesses: 0,
      remainingAttempts: 0,
    };

    expect(isReady(completedState)).toBe(true);
    if (isReady(completedState)) {
      expect(completedState.isComplete).toBe(true);
      expect(completedState.hasWon).toBe(true);
    }
  });

  it("handles error state with different error messages", () => {
    const networkError: ErrorState = {
      status: "error",
      error: "Network connection failed",
    };

    const authError: ErrorState = {
      status: "error",
      error: "Authentication required",
    };

    expect(isError(networkError)).toBe(true);
    expect(isError(authError)).toBe(true);

    if (isError(networkError)) {
      expect(networkError.error).toBe("Network connection failed");
    }
  });
});
