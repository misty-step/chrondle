import { describe, expect, it } from "vitest";
import { deriveOrderGameState, type OrderDataSources } from "@/lib/deriveOrderGameState";
import type { OrderPuzzle } from "@/types/orderGameState";
import type { Id } from "../../../convex/_generated/dataModel";

const basePuzzle: OrderPuzzle = {
  id: "orderPuzzle_1" as Id<"orderPuzzles">,
  date: "2025-11-10",
  puzzleNumber: 1,
  seed: "seed",
  events: [
    { id: "event-a", year: 1200, text: "Event A" },
    { id: "event-b", year: 1300, text: "Event B" },
    { id: "event-c", year: 1400, text: "Event C" },
  ],
};

function buildSources(overrides: Partial<OrderDataSources>): OrderDataSources {
  return {
    puzzle: { puzzle: basePuzzle, isLoading: false, error: null },
    auth: { userId: null, isAuthenticated: false, isLoading: false },
    progress: { progress: null, isLoading: false },
    session: {
      ordering: basePuzzle.events.map((event) => event.id),
      hints: [],
      committedAt: null,
      score: null,
    },
    ...overrides,
  } as OrderDataSources;
}

describe("deriveOrderGameState", () => {
  it("locks anchored events even if session ordering disagrees", () => {
    const sources = buildSources({
      session: {
        ordering: ["event-b", "event-a", "event-c"],
        hints: [{ type: "anchor", eventId: "event-b", position: 2 }],
        committedAt: null,
        score: null,
      },
    });

    const state = deriveOrderGameState(sources);
    if (state.status !== "ready") {
      throw new Error("Expected ready state");
    }
    expect(state.currentOrder).toEqual(["event-a", "event-c", "event-b"]);
  });

  it("enforces locks for completed sessions", () => {
    const sources = buildSources({
      session: {
        ordering: ["event-c", "event-b", "event-a"],
        hints: [{ type: "anchor", eventId: "event-a", position: 0 }],
        committedAt: Date.now(),
        score: {
          totalScore: 10,
          correctPairs: 3,
          totalPairs: 3,
          perfectPositions: 1,
          hintsUsed: 1,
        },
      },
    });

    const state = deriveOrderGameState(sources);
    if (state.status !== "completed") {
      throw new Error("Expected completed state");
    }
    expect(state.finalOrder[0]).toBe("event-a");
    expect(new Set(state.finalOrder)).toEqual(new Set(["event-a", "event-b", "event-c"]));
  });
});
