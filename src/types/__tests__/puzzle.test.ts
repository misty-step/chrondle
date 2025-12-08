import { describe, it, expect } from "vitest";
import type { Id } from "convex/_generated/dataModel";
import {
  hasHistoricalContext,
  isValidPuzzle,
  type Puzzle,
  type PuzzleWithContext,
} from "../puzzle";

// Test fixtures
const validPuzzle: Puzzle = {
  id: "test-puzzle-id" as Id<"puzzles">,
  targetYear: 1969,
  events: ["Event 1", "Event 2", "Event 3", "Event 4", "Event 5", "Event 6"],
  puzzleNumber: 42,
};

const puzzleWithContext: PuzzleWithContext = {
  ...validPuzzle,
  historicalContext: "1969 was a transformative year marked by the moon landing...",
};

describe("hasHistoricalContext", () => {
  it("returns true when puzzle has historicalContext", () => {
    expect(hasHistoricalContext(puzzleWithContext)).toBe(true);
  });

  it("returns false when puzzle lacks historicalContext", () => {
    expect(hasHistoricalContext(validPuzzle)).toBe(false);
  });

  it("returns false when historicalContext is undefined", () => {
    const puzzleWithUndefinedContext: PuzzleWithContext = {
      ...validPuzzle,
      historicalContext: undefined,
    };
    expect(hasHistoricalContext(puzzleWithUndefinedContext)).toBe(false);
  });

  it("narrows type correctly for property access", () => {
    const puzzle: Puzzle | PuzzleWithContext = puzzleWithContext;
    if (hasHistoricalContext(puzzle)) {
      // TypeScript should allow access to historicalContext
      expect(puzzle.historicalContext).toBe(
        "1969 was a transformative year marked by the moon landing...",
      );
    }
  });

  it("handles empty string historicalContext as having context", () => {
    const puzzleWithEmptyContext: PuzzleWithContext = {
      ...validPuzzle,
      historicalContext: "",
    };
    // Empty string is truthy for "in" check but we check !== undefined
    expect(hasHistoricalContext(puzzleWithEmptyContext)).toBe(true);
  });
});

describe("isValidPuzzle", () => {
  describe("valid puzzles", () => {
    it("returns true for a valid puzzle", () => {
      expect(isValidPuzzle(validPuzzle)).toBe(true);
    });

    it("returns true for a puzzle with historical context", () => {
      expect(isValidPuzzle(puzzleWithContext)).toBe(true);
    });

    it("returns true for puzzle with exactly 6 events", () => {
      expect(isValidPuzzle(validPuzzle)).toBe(true);
      expect(validPuzzle.events).toHaveLength(6);
    });

    it("returns true for puzzle with various targetYear values", () => {
      const ancientPuzzle = { ...validPuzzle, targetYear: -500 }; // BC
      const modernPuzzle = { ...validPuzzle, targetYear: 2024 };
      const yearZeroPuzzle = { ...validPuzzle, targetYear: 0 };

      expect(isValidPuzzle(ancientPuzzle)).toBe(true);
      expect(isValidPuzzle(modernPuzzle)).toBe(true);
      expect(isValidPuzzle(yearZeroPuzzle)).toBe(true);
    });
  });

  describe("invalid puzzles", () => {
    it("returns false for null", () => {
      expect(isValidPuzzle(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidPuzzle(undefined)).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isValidPuzzle("string")).toBe(false);
      expect(isValidPuzzle(123)).toBe(false);
      expect(isValidPuzzle(true)).toBe(false);
    });

    it("returns false for empty object", () => {
      expect(isValidPuzzle({})).toBe(false);
    });

    it("returns false for missing id", () => {
      const { id: _, ...puzzleWithoutId } = validPuzzle;
      expect(isValidPuzzle(puzzleWithoutId)).toBe(false);
    });

    it("returns false for non-string id", () => {
      const puzzleWithNumberId = { ...validPuzzle, id: 123 };
      expect(isValidPuzzle(puzzleWithNumberId)).toBe(false);
    });

    it("returns false for missing targetYear", () => {
      const { targetYear: _, ...puzzleWithoutYear } = validPuzzle;
      expect(isValidPuzzle(puzzleWithoutYear)).toBe(false);
    });

    it("returns false for non-number targetYear", () => {
      const puzzleWithStringYear = { ...validPuzzle, targetYear: "1969" };
      expect(isValidPuzzle(puzzleWithStringYear)).toBe(false);
    });

    it("returns false for missing events", () => {
      const { events: _, ...puzzleWithoutEvents } = validPuzzle;
      expect(isValidPuzzle(puzzleWithoutEvents)).toBe(false);
    });

    it("returns false for non-array events", () => {
      const puzzleWithStringEvents = { ...validPuzzle, events: "Event 1" };
      expect(isValidPuzzle(puzzleWithStringEvents)).toBe(false);
    });

    it("returns false for fewer than 6 events", () => {
      const puzzleWithFewEvents = {
        ...validPuzzle,
        events: ["Event 1", "Event 2", "Event 3"],
      };
      expect(isValidPuzzle(puzzleWithFewEvents)).toBe(false);
    });

    it("returns false for more than 6 events", () => {
      const puzzleWithManyEvents = {
        ...validPuzzle,
        events: ["E1", "E2", "E3", "E4", "E5", "E6", "E7"],
      };
      expect(isValidPuzzle(puzzleWithManyEvents)).toBe(false);
    });

    it("returns false for events containing non-strings", () => {
      const puzzleWithMixedEvents = {
        ...validPuzzle,
        events: ["Event 1", 2, "Event 3", "Event 4", "Event 5", "Event 6"],
      };
      expect(isValidPuzzle(puzzleWithMixedEvents)).toBe(false);
    });

    it("returns false for missing puzzleNumber", () => {
      const { puzzleNumber: _, ...puzzleWithoutNumber } = validPuzzle;
      expect(isValidPuzzle(puzzleWithoutNumber)).toBe(false);
    });

    it("returns false for non-number puzzleNumber", () => {
      const puzzleWithStringNumber = { ...validPuzzle, puzzleNumber: "42" };
      expect(isValidPuzzle(puzzleWithStringNumber)).toBe(false);
    });

    it("returns false for puzzleNumber <= 0", () => {
      const puzzleWithZeroNumber = { ...validPuzzle, puzzleNumber: 0 };
      const puzzleWithNegativeNumber = { ...validPuzzle, puzzleNumber: -1 };

      expect(isValidPuzzle(puzzleWithZeroNumber)).toBe(false);
      expect(isValidPuzzle(puzzleWithNegativeNumber)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for array instead of object", () => {
      expect(isValidPuzzle([1, 2, 3])).toBe(false);
    });

    it("returns true for puzzle with additional properties", () => {
      const puzzleWithExtra = {
        ...validPuzzle,
        extraField: "extra value",
      };
      expect(isValidPuzzle(puzzleWithExtra)).toBe(true);
    });

    it("handles events with empty strings", () => {
      const puzzleWithEmptyEvents = {
        ...validPuzzle,
        events: ["", "", "", "", "", ""],
      };
      // Empty strings are still strings
      expect(isValidPuzzle(puzzleWithEmptyEvents)).toBe(true);
    });

    it("returns false for events with null values", () => {
      const puzzleWithNullEvent = {
        ...validPuzzle,
        events: ["E1", null, "E3", "E4", "E5", "E6"],
      };
      expect(isValidPuzzle(puzzleWithNullEvent)).toBe(false);
    });

    it("returns false for events with undefined values", () => {
      const puzzleWithUndefinedEvent = {
        ...validPuzzle,
        events: ["E1", undefined, "E3", "E4", "E5", "E6"],
      };
      expect(isValidPuzzle(puzzleWithUndefinedEvent)).toBe(false);
    });
  });
});
