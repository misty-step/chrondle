import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  evaluateOrdering,
  createAttempt,
  isSolved,
  wouldSolve,
  calculateAttemptScore,
  getCorrectOrder,
  formatProgress,
  getCorrectPositionCount,
} from "../attemptScoring";
import type { OrderAttempt, OrderEvent } from "@/types/orderGameState";

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestEvents = (years: number[]): OrderEvent[] =>
  years.map((year, i) => ({
    id: `event-${i}`,
    year,
    text: `Event ${i}`,
  }));

const createMockAttempt = (overrides: Partial<OrderAttempt> = {}): OrderAttempt => ({
  ordering: ["a", "b", "c"],
  feedback: ["correct", "correct", "correct"],
  pairsCorrect: 3,
  totalPairs: 3,
  timestamp: Date.now(),
  ...overrides,
});

// =============================================================================
// getCorrectOrder
// =============================================================================

describe("getCorrectOrder", () => {
  it("sorts events by year ascending", () => {
    const events = createTestEvents([2000, 1990, 1995]);
    const result = getCorrectOrder(events);

    expect(result).toEqual(["event-1", "event-2", "event-0"]);
  });

  it("handles same year by sorting by id", () => {
    const events: OrderEvent[] = [
      { id: "z-event", year: 2000, text: "Z" },
      { id: "a-event", year: 2000, text: "A" },
      { id: "m-event", year: 2000, text: "M" },
    ];
    const result = getCorrectOrder(events);

    expect(result).toEqual(["a-event", "m-event", "z-event"]);
  });

  it("returns empty array for empty events", () => {
    expect(getCorrectOrder([])).toEqual([]);
  });

  it("handles single event", () => {
    const events = createTestEvents([1999]);
    expect(getCorrectOrder(events)).toEqual(["event-0"]);
  });

  it("handles negative years (BC)", () => {
    const events = createTestEvents([-500, 100, -1000]);
    const result = getCorrectOrder(events);

    expect(result).toEqual(["event-2", "event-0", "event-1"]);
  });
});

// =============================================================================
// evaluateOrdering
// =============================================================================

describe("evaluateOrdering", () => {
  it("returns all correct feedback for perfect ordering", () => {
    const events = createTestEvents([1990, 1995, 2000]);
    const ordering = ["event-0", "event-1", "event-2"];

    const result = evaluateOrdering(ordering, events);

    expect(result.feedback).toEqual(["correct", "correct", "correct"]);
    expect(result.pairsCorrect).toBe(3);
    expect(result.totalPairs).toBe(3);
  });

  it("returns feedback for reversed ordering (middle element stays correct)", () => {
    const events = createTestEvents([1990, 1995, 2000]);
    const ordering = ["event-2", "event-1", "event-0"]; // Reversed

    const result = evaluateOrdering(ordering, events);

    // Middle element (event-1) is still in correct position!
    expect(result.feedback).toEqual(["incorrect", "correct", "incorrect"]);
    expect(result.pairsCorrect).toBe(0); // All pairs are in wrong relative order
    expect(result.totalPairs).toBe(3);
  });

  it("returns mixed feedback for partial ordering", () => {
    const events = createTestEvents([1990, 1995, 2000]);
    const ordering = ["event-0", "event-2", "event-1"]; // First correct, others swapped

    const result = evaluateOrdering(ordering, events);

    expect(result.feedback).toEqual(["correct", "incorrect", "incorrect"]);
  });

  it("calculates correct pairs for 6 events", () => {
    const events = createTestEvents([1, 2, 3, 4, 5, 6]);
    const ordering = events.map((e) => e.id); // Perfect order

    const result = evaluateOrdering(ordering, events);

    // C(6,2) = 15 pairs
    expect(result.totalPairs).toBe(15);
    expect(result.pairsCorrect).toBe(15);
  });

  it("preserves ordering in result", () => {
    const events = createTestEvents([1990, 2000]);
    const ordering = ["event-1", "event-0"];

    const result = evaluateOrdering(ordering, events);

    expect(result.ordering).toEqual(ordering);
  });
});

// =============================================================================
// createAttempt
// =============================================================================

describe("createAttempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes timestamp", () => {
    const events = createTestEvents([1990, 2000]);
    const result = createAttempt(["event-0", "event-1"], events);

    expect(result.timestamp).toBe(Date.now());
  });

  it("includes evaluation results", () => {
    const events = createTestEvents([1990, 2000]);
    const result = createAttempt(["event-0", "event-1"], events);

    expect(result.feedback).toEqual(["correct", "correct"]);
    expect(result.ordering).toEqual(["event-0", "event-1"]);
  });
});

// =============================================================================
// isSolved
// =============================================================================

describe("isSolved", () => {
  it("returns true when all positions are correct", () => {
    const attempt = createMockAttempt({
      feedback: ["correct", "correct", "correct"],
    });

    expect(isSolved(attempt)).toBe(true);
  });

  it("returns false when any position is incorrect", () => {
    const attempt = createMockAttempt({
      feedback: ["correct", "incorrect", "correct"],
    });

    expect(isSolved(attempt)).toBe(false);
  });

  it("returns false when all positions are incorrect", () => {
    const attempt = createMockAttempt({
      feedback: ["incorrect", "incorrect", "incorrect"],
    });

    expect(isSolved(attempt)).toBe(false);
  });

  it("returns true for empty feedback (edge case)", () => {
    const attempt = createMockAttempt({ feedback: [] });

    expect(isSolved(attempt)).toBe(true);
  });
});

// =============================================================================
// wouldSolve
// =============================================================================

describe("wouldSolve", () => {
  it("returns true for correct ordering", () => {
    const events = createTestEvents([1990, 1995, 2000]);
    const ordering = ["event-0", "event-1", "event-2"];

    expect(wouldSolve(ordering, events)).toBe(true);
  });

  it("returns false for incorrect ordering", () => {
    const events = createTestEvents([1990, 1995, 2000]);
    const ordering = ["event-2", "event-1", "event-0"];

    expect(wouldSolve(ordering, events)).toBe(false);
  });

  it("returns false for partially correct ordering", () => {
    const events = createTestEvents([1990, 1995, 2000]);
    const ordering = ["event-0", "event-2", "event-1"];

    expect(wouldSolve(ordering, events)).toBe(false);
  });

  it("returns true for empty events", () => {
    expect(wouldSolve([], [])).toBe(true);
  });
});

// =============================================================================
// calculateAttemptScore
// =============================================================================

describe("calculateAttemptScore", () => {
  it("returns attempt count", () => {
    const attempts = [createMockAttempt(), createMockAttempt(), createMockAttempt()];

    const result = calculateAttemptScore(attempts);

    expect(result.attempts).toBe(3);
  });

  it("returns 0 for empty attempts", () => {
    expect(calculateAttemptScore([]).attempts).toBe(0);
  });

  it("returns 1 for single attempt", () => {
    expect(calculateAttemptScore([createMockAttempt()]).attempts).toBe(1);
  });
});

// =============================================================================
// formatProgress
// =============================================================================

describe("formatProgress", () => {
  it("formats all correct", () => {
    const attempt = createMockAttempt({
      feedback: ["correct", "correct", "correct"],
    });

    expect(formatProgress(attempt)).toBe("3/3 correct");
  });

  it("formats partial correct", () => {
    const attempt = createMockAttempt({
      feedback: ["correct", "incorrect", "correct", "incorrect"],
    });

    expect(formatProgress(attempt)).toBe("2/4 correct");
  });

  it("formats none correct", () => {
    const attempt = createMockAttempt({
      feedback: ["incorrect", "incorrect"],
    });

    expect(formatProgress(attempt)).toBe("0/2 correct");
  });

  it("handles empty feedback", () => {
    const attempt = createMockAttempt({ feedback: [] });

    expect(formatProgress(attempt)).toBe("0/0 correct");
  });
});

// =============================================================================
// getCorrectPositionCount
// =============================================================================

describe("getCorrectPositionCount", () => {
  it("counts all correct positions", () => {
    const attempt = createMockAttempt({
      feedback: ["correct", "correct", "correct"],
    });

    expect(getCorrectPositionCount(attempt)).toBe(3);
  });

  it("counts partial correct positions", () => {
    const attempt = createMockAttempt({
      feedback: ["correct", "incorrect", "correct", "incorrect", "correct"],
    });

    expect(getCorrectPositionCount(attempt)).toBe(3);
  });

  it("returns 0 for no correct positions", () => {
    const attempt = createMockAttempt({
      feedback: ["incorrect", "incorrect", "incorrect"],
    });

    expect(getCorrectPositionCount(attempt)).toBe(0);
  });

  it("returns 0 for empty feedback", () => {
    const attempt = createMockAttempt({ feedback: [] });

    expect(getCorrectPositionCount(attempt)).toBe(0);
  });
});
