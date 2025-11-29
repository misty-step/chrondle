import { describe, expect, it } from "vitest";
import {
  arraysEqual,
  evaluateOrdering,
  getCorrectOrder,
  isSolved,
  wouldSolve,
} from "../orderValidation";

// Mock puzzle data (realistic structure from DB)
const mockEvents = [
  { id: "a", year: 1200, text: "Event A" },
  { id: "b", year: 1400, text: "Event B" },
  { id: "c", year: 1600, text: "Event C" },
  { id: "d", year: 1800, text: "Event D" },
];

describe("orderValidation", () => {
  describe("getCorrectOrder", () => {
    it("returns IDs in chronological order", () => {
      const shuffled = [mockEvents[2], mockEvents[0], mockEvents[3], mockEvents[1]];
      expect(getCorrectOrder(shuffled)).toEqual(["a", "b", "c", "d"]);
    });

    it("handles year ties with deterministic ID sort", () => {
      const tied = [
        { id: "b", year: 1500, text: "B" },
        { id: "a", year: 1500, text: "A" },
      ];
      expect(getCorrectOrder(tied)).toEqual(["a", "b"]);
    });

    it("preserves original array (pure function)", () => {
      const original = [...mockEvents];
      getCorrectOrder(mockEvents);
      expect(mockEvents).toEqual(original);
    });
  });

  describe("wouldSolve", () => {
    it("returns true for correct ordering", () => {
      expect(wouldSolve(["a", "b", "c", "d"], mockEvents)).toBe(true);
    });

    it("returns false for incorrect ordering", () => {
      expect(wouldSolve(["b", "a", "c", "d"], mockEvents)).toBe(false);
    });

    it("returns false for partially correct ordering", () => {
      expect(wouldSolve(["a", "b", "d", "c"], mockEvents)).toBe(false);
    });

    it("returns false for completely reversed ordering", () => {
      expect(wouldSolve(["d", "c", "b", "a"], mockEvents)).toBe(false);
    });
  });

  describe("evaluateOrdering", () => {
    it("computes correct feedback for perfect ordering", () => {
      const result = evaluateOrdering(["a", "b", "c", "d"], mockEvents);
      expect(result.feedback).toEqual(["correct", "correct", "correct", "correct"]);
      expect(result.pairsCorrect).toBe(6); // C(4,2) = 6 pairs
      expect(result.totalPairs).toBe(6);
    });

    it("computes feedback for partially correct ordering", () => {
      const result = evaluateOrdering(["a", "c", "b", "d"], mockEvents);
      expect(result.feedback).toEqual([
        "correct", // a in position 0 ✓
        "incorrect", // c in position 1 (should be b)
        "incorrect", // b in position 2 (should be c)
        "correct", // d in position 3 ✓
      ]);
      // Pairs: a<c ✓, a<b ✓, a<d ✓, c<b ✗, c<d ✓, b<d ✓ = 5/6
      expect(result.pairsCorrect).toBe(5);
      expect(result.totalPairs).toBe(6);
    });

    it("computes zero pairs for completely reversed ordering", () => {
      const result = evaluateOrdering(["d", "c", "b", "a"], mockEvents);
      expect(result.feedback).toEqual(["incorrect", "incorrect", "incorrect", "incorrect"]);
      expect(result.pairsCorrect).toBe(0);
      expect(result.totalPairs).toBe(6);
    });

    it("includes ordering in result", () => {
      const ordering = ["a", "b", "c", "d"];
      const result = evaluateOrdering(ordering, mockEvents);
      expect(result.ordering).toEqual(ordering);
    });
  });

  describe("isSolved", () => {
    it("returns true when all feedback is correct", () => {
      expect(isSolved({ feedback: ["correct", "correct", "correct"] })).toBe(true);
    });

    it("returns false when any feedback is incorrect", () => {
      expect(isSolved({ feedback: ["correct", "incorrect", "correct"] })).toBe(false);
    });

    it("returns false when all feedback is incorrect", () => {
      expect(isSolved({ feedback: ["incorrect", "incorrect"] })).toBe(false);
    });

    it("returns true for empty feedback (edge case)", () => {
      expect(isSolved({ feedback: [] })).toBe(true);
    });
  });

  describe("arraysEqual", () => {
    it("returns true for identical arrays", () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it("returns false for different values", () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it("returns false for different lengths", () => {
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it("returns true for empty arrays", () => {
      expect(arraysEqual([], [])).toBe(true);
    });

    it("works with string arrays", () => {
      expect(arraysEqual(["a", "b"], ["a", "b"])).toBe(true);
      expect(arraysEqual(["a", "b"], ["b", "a"])).toBe(false);
    });
  });

  describe("edge cases and invariants", () => {
    it("handles single event correctly", () => {
      const single = [{ id: "x", year: 2000, text: "X" }];
      expect(getCorrectOrder(single)).toEqual(["x"]);
      expect(wouldSolve(["x"], single)).toBe(true);

      const result = evaluateOrdering(["x"], single);
      expect(result.feedback).toEqual(["correct"]);
      expect(result.pairsCorrect).toBe(0); // C(1,2) = 0 pairs
      expect(result.totalPairs).toBe(0);
    });

    it("handles six events (typical puzzle size)", () => {
      const six = [
        { id: "a", year: 1000, text: "A" },
        { id: "b", year: 1200, text: "B" },
        { id: "c", year: 1400, text: "C" },
        { id: "d", year: 1600, text: "D" },
        { id: "e", year: 1800, text: "E" },
        { id: "f", year: 2000, text: "F" },
      ];

      const result = evaluateOrdering(["a", "b", "c", "d", "e", "f"], six);
      expect(result.pairsCorrect).toBe(15); // C(6,2) = 15 pairs
      expect(result.totalPairs).toBe(15);
    });
  });
});
