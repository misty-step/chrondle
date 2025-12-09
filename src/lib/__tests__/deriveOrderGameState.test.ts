import { describe, it, expect } from "vitest";
import { deriveOrderGameState, type OrderDataSources } from "../deriveOrderGameState";
import type { OrderPuzzle, PositionFeedback } from "@/types/orderGameState";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Tests for deriveOrderGameState pure function
 *
 * This function derives the Order game state from orthogonal data sources.
 * Pattern: Pure function taking data sources → returns game state
 */

// Helper to create a mock puzzle
function createMockPuzzle(overrides: Partial<OrderPuzzle> = {}): OrderPuzzle {
  return {
    id: "puzzle-1" as Id<"orderPuzzles">,
    puzzleNumber: 1,
    date: "2024-01-01",
    seed: "test-seed-12345",
    events: [
      { id: "event1", year: 1776, text: "American Independence" },
      { id: "event2", year: 1789, text: "French Revolution" },
      { id: "event3", year: 1815, text: "Battle of Waterloo" },
      { id: "event4", year: 1848, text: "1848 Revolutions" },
      { id: "event5", year: 1861, text: "Civil War begins" },
      { id: "event6", year: 1914, text: "WWI begins" },
    ],
    ...overrides,
  };
}

// Helper to create default data sources
function createDataSources(overrides: Partial<OrderDataSources> = {}): OrderDataSources {
  return {
    puzzle: {
      puzzle: createMockPuzzle(),
      isLoading: false,
      error: null,
    },
    auth: {
      userId: "user-123",
      isAuthenticated: true,
      isLoading: false,
    },
    progress: {
      progress: null,
      isLoading: false,
    },
    session: {
      ordering: ["event1", "event2", "event3", "event4", "event5", "event6"],
      attempts: [],
      completedAt: null,
      score: null,
    },
    ...overrides,
  };
}

describe("deriveOrderGameState", () => {
  describe("Loading States", () => {
    it("returns loading-puzzle when puzzle is loading", () => {
      const sources = createDataSources({
        puzzle: { puzzle: null, isLoading: true, error: null },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("loading-puzzle");
    });

    it("returns loading-auth when auth is loading", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: true },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("loading-auth");
    });

    it("returns loading-progress when authenticated and progress loading", () => {
      const sources = createDataSources({
        auth: { userId: "user-123", isAuthenticated: true, isLoading: false },
        progress: { progress: null, isLoading: true },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("loading-progress");
    });

    it("does not wait for progress when not authenticated", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        progress: { progress: null, isLoading: true },
      });

      const state = deriveOrderGameState(sources);

      // Should proceed to ready state, not loading-progress
      expect(state.status).toBe("ready");
    });
  });

  describe("Error States", () => {
    it("returns error when puzzle has error", () => {
      const sources = createDataSources({
        puzzle: { puzzle: null, isLoading: false, error: new Error("Network error") },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("error");
      if (state.status === "error") {
        expect(state.error).toBe("Network error");
      }
    });

    it("returns error when no puzzle available", () => {
      const sources = createDataSources({
        puzzle: { puzzle: null, isLoading: false, error: null },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("error");
      if (state.status === "error") {
        expect(state.error).toBe("No Order puzzle available");
      }
    });
  });

  describe("Ready State", () => {
    it("returns ready state with current ordering", () => {
      const sources = createDataSources();

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.puzzle.puzzleNumber).toBe(1);
        expect(state.currentOrder).toEqual([
          "event1",
          "event2",
          "event3",
          "event4",
          "event5",
          "event6",
        ]);
        expect(state.attempts).toEqual([]);
      }
    });

    it("includes attempts from session", () => {
      const sources = createDataSources({
        session: {
          ordering: ["event2", "event1", "event3", "event4", "event5", "event6"],
          attempts: [
            {
              ordering: ["event2", "event1", "event3", "event4", "event5", "event6"],
              feedback: [
                "incorrect",
                "incorrect",
                "correct",
                "correct",
                "correct",
                "correct",
              ] as PositionFeedback[],
              pairsCorrect: 4,
              totalPairs: 5,
              timestamp: 1234567890,
            },
          ],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.currentOrder).toEqual([
          "event2",
          "event1",
          "event3",
          "event4",
          "event5",
          "event6",
        ]);
        expect(state.attempts).toHaveLength(1);
      }
    });
  });

  describe("Completed State", () => {
    it("returns completed state when session has completedAt", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        session: {
          ordering: ["event1", "event2", "event3", "event4", "event5", "event6"],
          attempts: [
            {
              ordering: ["event1", "event2", "event3", "event4", "event5", "event6"],
              feedback: ["correct", "correct", "correct", "correct", "correct", "correct"],
              pairsCorrect: 5,
              totalPairs: 5,
              timestamp: 1234567890,
            },
          ],
          completedAt: 1234567890,
          score: { attempts: 1 },
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("completed");
      if (state.status === "completed") {
        expect(state.finalOrder).toEqual([
          "event1",
          "event2",
          "event3",
          "event4",
          "event5",
          "event6",
        ]);
        expect(state.score.attempts).toBe(1);
      }
    });

    it("returns completed state when server progress has completedAt", () => {
      const sources = createDataSources({
        auth: { userId: "user-123", isAuthenticated: true, isLoading: false },
        progress: {
          progress: {
            ordering: ["event1", "event2", "event3", "event4", "event5", "event6"],
            attempts: [
              {
                ordering: ["event1", "event2", "event3", "event4", "event5", "event6"],
                feedback: ["correct", "correct", "correct", "correct", "correct", "correct"],
                pairsCorrect: 5,
                totalPairs: 5,
                timestamp: 1234567890,
              },
            ],
            completedAt: 1234567890,
            score: { attempts: 1 },
          },
          isLoading: false,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("completed");
      if (state.status === "completed") {
        expect(state.score.attempts).toBe(1);
      }
    });
  });

  describe("State Resolution Priority", () => {
    it("prefers server progress over session for authenticated users", () => {
      const sources = createDataSources({
        auth: { userId: "user-123", isAuthenticated: true, isLoading: false },
        progress: {
          progress: {
            ordering: ["event6", "event5", "event4", "event3", "event2", "event1"],
            attempts: [
              {
                ordering: ["event6", "event5", "event4", "event3", "event2", "event1"],
                feedback: [
                  "incorrect",
                  "incorrect",
                  "incorrect",
                  "incorrect",
                  "incorrect",
                  "incorrect",
                ] as PositionFeedback[],
                pairsCorrect: 0,
                totalPairs: 5,
                timestamp: 1234567890,
              },
            ],
            completedAt: null,
            score: null,
          },
          isLoading: false,
        },
        session: {
          ordering: ["event1", "event2", "event3", "event4", "event5", "event6"],
          attempts: [],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        // Should use server ordering, not session
        expect(state.currentOrder).toEqual([
          "event6",
          "event5",
          "event4",
          "event3",
          "event2",
          "event1",
        ]);
        expect(state.attempts).toHaveLength(1);
      }
    });

    it("uses session state when not authenticated", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        progress: { progress: null, isLoading: false },
        session: {
          ordering: ["event3", "event2", "event1", "event4", "event5", "event6"],
          attempts: [],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.currentOrder).toEqual([
          "event3",
          "event2",
          "event1",
          "event4",
          "event5",
          "event6",
        ]);
      }
    });
  });

  describe("Ordering Normalization", () => {
    it("normalizes empty ordering to baseline", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        session: {
          ordering: [],
          attempts: [],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        // Should fall back to baseline (puzzle events)
        expect(state.currentOrder).toEqual([
          "event1",
          "event2",
          "event3",
          "event4",
          "event5",
          "event6",
        ]);
      }
    });

    it("removes duplicate IDs from ordering", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        session: {
          ordering: [
            "event1",
            "event1",
            "event2",
            "event2",
            "event3",
            "event4",
            "event5",
            "event6",
          ],
          attempts: [],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.currentOrder).toEqual([
          "event1",
          "event2",
          "event3",
          "event4",
          "event5",
          "event6",
        ]);
      }
    });

    it("removes unknown IDs from ordering", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        session: {
          ordering: ["event1", "unknown-id", "event2", "event3", "event4", "event5", "event6"],
          attempts: [],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.currentOrder).toEqual([
          "event1",
          "event2",
          "event3",
          "event4",
          "event5",
          "event6",
        ]);
      }
    });

    it("adds missing IDs to ordering", () => {
      const sources = createDataSources({
        auth: { userId: null, isAuthenticated: false, isLoading: false },
        session: {
          ordering: ["event3", "event1"], // Missing 4 events
          attempts: [],
          completedAt: null,
          score: null,
        },
      });

      const state = deriveOrderGameState(sources);

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        // Should have all 6 events: first the provided, then missing ones
        expect(state.currentOrder).toHaveLength(6);
        expect(state.currentOrder[0]).toBe("event3");
        expect(state.currentOrder[1]).toBe("event1");
        // Missing events added in baseline order
        expect(state.currentOrder).toContain("event2");
        expect(state.currentOrder).toContain("event4");
        expect(state.currentOrder).toContain("event5");
        expect(state.currentOrder).toContain("event6");
      }
    });
  });
});
