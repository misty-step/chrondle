import { describe, expect, it } from "vitest";
import { Id } from "convex/_generated/dataModel";
import {
  deriveOrderGameState,
  type OrderDataSources,
  type OrderProgressData,
  type OrderSessionState,
} from "@/lib/deriveOrderGameState";
import type { OrderHint, OrderScore } from "@/types/orderGameState";

const sampleEvents = [
  { id: "event-a", year: 1200, text: "Event A" },
  { id: "event-b", year: 1800, text: "Event B" },
  { id: "event-c", year: 1500, text: "Event C" },
];

const samplePuzzle = {
  id: "order-1" as Id<"orderPuzzles">,
  date: "2025-11-08",
  puzzleNumber: 88,
  events: sampleEvents,
  seed: "seed-1",
};

const baseSession = (): OrderSessionState => ({
  ordering: sampleEvents.map((event) => event.id),
  hints: [],
  committedAt: null,
  score: null,
});

const createSources = (overrides?: Partial<OrderDataSources>): OrderDataSources => ({
  puzzle: {
    puzzle: samplePuzzle,
    isLoading: false,
    error: null,
    ...(overrides?.puzzle ?? {}),
  },
  auth: {
    userId: null,
    isAuthenticated: false,
    isLoading: false,
    ...(overrides?.auth ?? {}),
  },
  progress: {
    progress: null,
    isLoading: false,
    ...(overrides?.progress ?? {}),
  },
  session: {
    ...baseSession(),
    ...(overrides?.session ?? {}),
  },
});

const sampleScore: OrderScore = {
  totalScore: 24,
  correctPairs: 12,
  totalPairs: 15,
  perfectPositions: 2,
  hintsUsed: 1,
};

describe("deriveOrderGameState (Order)", () => {
  describe("Loading & Error States", () => {
    it("returns loading-puzzle when puzzle is loading", () => {
      const state = deriveOrderGameState(
        createSources({
          puzzle: { puzzle: null, isLoading: true, error: null },
        }),
      );
      expect(state).toEqual({ status: "loading-puzzle" });
    });

    it("returns loading-auth when auth is loading", () => {
      const state = deriveOrderGameState(
        createSources({
          auth: { userId: null, isAuthenticated: false, isLoading: true },
        }),
      );
      expect(state).toEqual({ status: "loading-auth" });
    });

    it("returns loading-progress when authed user progress is loading", () => {
      const state = deriveOrderGameState(
        createSources({
          auth: { userId: "user-1", isAuthenticated: true, isLoading: false },
          progress: { progress: null, isLoading: true },
        }),
      );
      expect(state).toEqual({ status: "loading-progress" });
    });

    it("returns error when puzzle resolver errors", () => {
      const state = deriveOrderGameState(
        createSources({
          puzzle: { puzzle: null, isLoading: false, error: new Error("boom") },
        }),
      );
      expect(state).toEqual({ status: "error", error: "boom" });
    });

    it("returns error when puzzle missing", () => {
      const state = deriveOrderGameState(
        createSources({
          puzzle: { puzzle: null, isLoading: false, error: null },
        }),
      );
      expect(state).toEqual({ status: "error", error: "No Order puzzle available" });
    });
  });

  describe("Ready State", () => {
    it("returns baseline ordering for new anonymous game", () => {
      const state = deriveOrderGameState(createSources());
      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.currentOrder).toEqual(sampleEvents.map((event) => event.id));
        expect(state.hints).toEqual([]);
      }
    });

    it("prefers session ordering when present", () => {
      const customOrder = ["event-c", "event-a", "event-b"];
      const state = deriveOrderGameState(
        createSources({
          session: { ordering: customOrder, hints: [], committedAt: null, score: null },
        }),
      );
      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.currentOrder).toEqual(customOrder);
      }
    });

    it("prefers server ordering and hints for authenticated users", () => {
      const serverHints: OrderHint[] = [{ type: "anchor", eventId: "event-a", position: 0 }];
      const progressData: OrderProgressData = {
        ordering: ["event-b", "event-c", "event-a"],
        hints: serverHints,
        completedAt: null,
        score: null,
      };
      const state = deriveOrderGameState(
        createSources({
          auth: { userId: "user-1", isAuthenticated: true, isLoading: false },
          progress: { progress: progressData, isLoading: false },
        }),
      );
      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        // Locked positions are enforced, so event-a (locked at 0) should be first
        expect(state.currentOrder).toEqual(["event-a", "event-b", "event-c"]);
        expect(state.hints).toEqual(serverHints);
      }
    });

    it("merges hints without duplicates", () => {
      const sharedHint: OrderHint = { type: "anchor", eventId: "event-a", position: 0 };
      const sessionHint: OrderHint = {
        type: "relative",
        earlierEventId: "event-b",
        laterEventId: "event-a",
      };
      const progressData: OrderProgressData = {
        ordering: sampleEvents.map((event) => event.id),
        hints: [sharedHint],
        completedAt: null,
        score: null,
      };
      const state = deriveOrderGameState(
        createSources({
          auth: { userId: "user-1", isAuthenticated: true, isLoading: false },
          progress: { progress: progressData, isLoading: false },
          session: {
            ...baseSession(),
            hints: [sharedHint, sessionHint],
          },
        }),
      );

      expect(state.status).toBe("ready");
      if (state.status === "ready") {
        expect(state.hints).toEqual([sharedHint, sessionHint]);
      }
    });
  });

  describe("Completed State", () => {
    it("returns completed state for authenticated users when server marks completion", () => {
      const progressData: OrderProgressData = {
        ordering: ["event-b", "event-a", "event-c"],
        hints: [],
        completedAt: Date.now(),
        score: sampleScore,
      };

      const state = deriveOrderGameState(
        createSources({
          auth: { userId: "user-1", isAuthenticated: true, isLoading: false },
          progress: { progress: progressData, isLoading: false },
        }),
      );

      expect(state.status).toBe("completed");
      if (state.status === "completed") {
        expect(state.finalOrder).toEqual(progressData.ordering);
        expect(state.correctOrder).toEqual(["event-a", "event-c", "event-b"]);
        expect(state.score).toEqual(sampleScore);
      }
    });

    it("returns completed state for anonymous sessions when committed locally", () => {
      const committedOrder = ["event-c", "event-a", "event-b"];
      const state = deriveOrderGameState(
        createSources({
          session: {
            ordering: committedOrder,
            hints: [],
            committedAt: Date.now(),
            score: sampleScore,
          },
        }),
      );

      expect(state.status).toBe("completed");
      if (state.status === "completed") {
        expect(state.finalOrder).toEqual(committedOrder);
        expect(state.score).toEqual(sampleScore);
      }
    });

    it("surfaces an error when completion lacks score data", () => {
      const progressData: OrderProgressData = {
        ordering: ["event-b", "event-a", "event-c"],
        hints: [],
        completedAt: Date.now(),
        score: null,
      };

      const state = deriveOrderGameState(
        createSources({
          auth: { userId: "user-1", isAuthenticated: true, isLoading: false },
          progress: { progress: progressData, isLoading: false },
        }),
      );

      expect(state.status).toBe("error");
      if (state.status === "error") {
        expect(state.error).toContain("Order state derivation failed");
      }
    });
  });
});
