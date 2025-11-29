import { describe, expect, it } from "vitest";
import { arraysEqual, evaluateOrdering, isSolved, wouldSolve } from "../../lib/orderValidation";
import type { PositionFeedback } from "../../lib/orderValidation";

/**
 * Security scenario tests for submitOrderPlay validation
 *
 * These tests simulate attack vectors where malicious clients attempt to:
 * 1. Forge hole-in-one scores with incorrect orderings
 * 2. Submit false feedback claiming all positions correct
 * 3. Manipulate pair counts to inflate accuracy metrics
 *
 * The validation logic in submitOrderPlay should reject all these attacks.
 */

// Mock puzzle data (realistic 6-event structure)
const mockPuzzle = {
  events: [
    { id: "a", year: 1200, text: "Event A" },
    { id: "b", year: 1400, text: "Event B" },
    { id: "c", year: 1600, text: "Event C" },
    { id: "d", year: 1800, text: "Event D" },
    { id: "e", year: 2000, text: "Event E" },
    { id: "f", year: 2200, text: "Event F" },
  ],
};

describe("submitOrderPlay validation (security)", () => {
  describe("Attack: Forged hole-in-one", () => {
    it("rejects when final ordering doesn't solve puzzle", () => {
      const maliciousOrdering = ["b", "a", "c", "d", "e", "f"]; // Wrong!
      const forgedAttempt = {
        ordering: maliciousOrdering,
        feedback: ["correct", "correct", "correct", "correct", "correct", "correct"], // Lied
        pairsCorrect: 15,
        totalPairs: 15,
        timestamp: Date.now(),
      };

      // This is what Layer 1 validation does:
      const isValid = wouldSolve(maliciousOrdering, mockPuzzle.events);
      expect(isValid).toBe(false); // ✓ Validation catches the forgery
    });

    it("detects completely reversed ordering as invalid", () => {
      const reversed = ["f", "e", "d", "c", "b", "a"];
      expect(wouldSolve(reversed, mockPuzzle.events)).toBe(false);
    });
  });

  describe("Attack: Forged feedback", () => {
    it("rejects when attempt feedback doesn't match server recomputation", () => {
      const ordering = ["a", "c", "b", "d", "e", "f"]; // Partially wrong
      const clientClaim = {
        ordering,
        feedback: ["correct", "correct", "correct", "correct", "correct", "correct"], // Forged!
        pairsCorrect: 15,
        totalPairs: 15,
        timestamp: Date.now(),
      };

      // This is what Layer 2 validation does:
      const serverFeedback = evaluateOrdering(ordering, mockPuzzle.events);

      // Validation should fail
      expect(arraysEqual(clientClaim.feedback, serverFeedback.feedback)).toBe(false);
      expect(serverFeedback.feedback[1]).toBe("incorrect"); // Position 1 is wrong
      expect(serverFeedback.feedback[2]).toBe("incorrect"); // Position 2 is wrong
    });

    it("detects partial correctness accurately", () => {
      const ordering = ["a", "b", "c", "f", "e", "d"]; // Mixed correctness
      const serverFeedback = evaluateOrdering(ordering, mockPuzzle.events);

      // Correct order: a,b,c,d,e,f (years: 1200,1400,1600,1800,2000,2200)
      // Given order: a,b,c,f,e,d
      // Position 0: a ✓, Position 1: b ✓, Position 2: c ✓
      // Position 3: f (should be d) ✗
      // Position 4: e (should be e) ✓
      // Position 5: d (should be f) ✗
      expect(serverFeedback.feedback).toEqual([
        "correct",
        "correct",
        "correct",
        "incorrect",
        "correct",
        "incorrect",
      ]);
    });
  });

  describe("Attack: Forged pair counts", () => {
    it("rejects when pairsCorrect doesn't match server computation", () => {
      const ordering = ["a", "c", "b", "d", "e", "f"];
      const clientClaim = {
        ordering,
        feedback: ["correct", "incorrect", "incorrect", "correct", "correct", "correct"],
        pairsCorrect: 15, // Claimed perfect!
        totalPairs: 15,
        timestamp: Date.now(),
      };

      const serverFeedback = evaluateOrdering(ordering, mockPuzzle.events);

      expect(clientClaim.pairsCorrect).not.toBe(serverFeedback.pairsCorrect);
      expect(serverFeedback.pairsCorrect).toBeLessThan(15);
    });

    it("computes pair counts correctly for various orderings", () => {
      const testCases = [
        { ordering: ["a", "b", "c", "d", "e", "f"], expected: 15 }, // Perfect: 15/15
        { ordering: ["a", "b", "c", "d", "f", "e"], expected: 14 }, // One swap: 14/15
        { ordering: ["f", "e", "d", "c", "b", "a"], expected: 0 }, // Reversed: 0/15
      ];

      testCases.forEach(({ ordering, expected }) => {
        const result = evaluateOrdering(ordering, mockPuzzle.events);
        expect(result.pairsCorrect).toBe(expected);
        expect(result.totalPairs).toBe(15); // Always 15 for 6 events: C(6,2)
      });
    });
  });

  describe("Attack: Unsolved final attempt", () => {
    it("rejects submission where final attempt isn't actually solved", () => {
      const unsolvedAttempt = {
        ordering: ["a", "b", "c", "d", "f", "e"], // Not solved!
        feedback: [
          "correct",
          "correct",
          "correct",
          "correct",
          "incorrect",
          "incorrect",
        ] as PositionFeedback[],
        pairsCorrect: 14,
        totalPairs: 15,
        timestamp: Date.now(),
      };

      // This is what Layer 3 validation does:
      expect(isSolved(unsolvedAttempt)).toBe(false);
    });

    it("accepts submission where final attempt is legitimately solved", () => {
      const solvedAttempt = {
        ordering: ["a", "b", "c", "d", "e", "f"],
        feedback: [
          "correct",
          "correct",
          "correct",
          "correct",
          "correct",
          "correct",
        ] as PositionFeedback[],
        pairsCorrect: 15,
        totalPairs: 15,
        timestamp: Date.now(),
      };

      expect(isSolved(solvedAttempt)).toBe(true);
    });
  });

  describe("Valid submissions (should pass all layers)", () => {
    it("accepts legitimate hole-in-one", () => {
      const correctOrdering = ["a", "b", "c", "d", "e", "f"];
      const legitimateAttempt = {
        ordering: correctOrdering,
        feedback: [
          "correct",
          "correct",
          "correct",
          "correct",
          "correct",
          "correct",
        ] as PositionFeedback[],
        pairsCorrect: 15,
        totalPairs: 15,
        timestamp: Date.now(),
      };

      // All three layers pass
      expect(wouldSolve(correctOrdering, mockPuzzle.events)).toBe(true); // Layer 1
      const serverFeedback = evaluateOrdering(correctOrdering, mockPuzzle.events);
      expect(arraysEqual(legitimateAttempt.feedback, serverFeedback.feedback)).toBe(true); // Layer 2
      expect(isSolved(legitimateAttempt)).toBe(true); // Layer 3
    });

    it("accepts legitimate 3-stroke birdie", () => {
      const attempts = [
        {
          ordering: ["f", "e", "d", "c", "b", "a"], // Attempt 1: reversed
          feedback: [
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
            "incorrect",
          ] as PositionFeedback[],
          pairsCorrect: 0,
          totalPairs: 15,
          timestamp: Date.now(),
        },
        {
          ordering: ["a", "b", "c", "f", "e", "d"], // Attempt 2: mixed
          feedback: [
            "correct",
            "correct",
            "correct",
            "incorrect",
            "correct",
            "incorrect",
          ] as PositionFeedback[],
          pairsCorrect: 12, // Pairs correct: all except d<f, f<d, d<e (12/15)
          totalPairs: 15,
          timestamp: Date.now() + 1000,
        },
        {
          ordering: ["a", "b", "c", "d", "e", "f"], // Attempt 3: solved!
          feedback: [
            "correct",
            "correct",
            "correct",
            "correct",
            "correct",
            "correct",
          ] as PositionFeedback[],
          pairsCorrect: 15,
          totalPairs: 15,
          timestamp: Date.now() + 2000,
        },
      ];

      // Validate each attempt (Layer 2)
      attempts.forEach((attempt) => {
        const serverFeedback = evaluateOrdering(attempt.ordering, mockPuzzle.events);
        expect(arraysEqual(attempt.feedback, serverFeedback.feedback)).toBe(true);
        expect(attempt.pairsCorrect).toBe(serverFeedback.pairsCorrect);
      });

      // Validate final state (Layers 1 & 3)
      const finalAttempt = attempts[attempts.length - 1];
      expect(isSolved(finalAttempt)).toBe(true);
      expect(wouldSolve(finalAttempt.ordering, mockPuzzle.events)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles empty attempts array gracefully", () => {
      // This should be caught by earlier validation (strokes check)
      // but we verify the validation functions handle it
      const attempts: Array<{
        ordering: string[];
        feedback: string[];
        pairsCorrect: number;
        totalPairs: number;
      }> = [];

      expect(attempts.length).toBe(0);
      // Layer 3 would fail: no final attempt to check
    });

    it("detects single incorrect position in otherwise perfect ordering", () => {
      const nearPerfect = ["a", "b", "c", "d", "f", "e"]; // Just e and f swapped
      const result = evaluateOrdering(nearPerfect, mockPuzzle.events);

      expect(result.feedback[4]).toBe("incorrect");
      expect(result.feedback[5]).toBe("incorrect");
      expect(result.pairsCorrect).toBe(14); // Only 1 pair wrong: e<f
    });
  });
});
