import { describe, expect, it } from "vitest";
import { scoreOrderSubmission } from "../orderScoring";

const makeEvents = (years: number[]) =>
  years.map((year, i) => ({ id: `event-${i}`, year, text: `Event ${i}` }));

describe("scoreOrderSubmission", () => {
  describe("perfect ordering", () => {
    it("scores maximum for perfect chronological order", () => {
      const events = makeEvents([1900, 1950, 2000]);
      const playerOrdering = ["event-0", "event-1", "event-2"]; // matches chronological

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      expect(result.correctPairs).toBe(3); // 3C2 = 3 pairs
      expect(result.totalPairs).toBe(3);
      expect(result.perfectPositions).toBe(3);
      expect(result.totalScore).toBe(6); // 3 * 2
    });

    it("scores maximum for 6 events in perfect order", () => {
      const events = makeEvents([1900, 1920, 1940, 1960, 1980, 2000]);
      const playerOrdering = ["event-0", "event-1", "event-2", "event-3", "event-4", "event-5"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      expect(result.correctPairs).toBe(15); // 6C2 = 15 pairs
      expect(result.totalPairs).toBe(15);
      expect(result.perfectPositions).toBe(6);
      expect(result.totalScore).toBe(30); // 15 * 2 = max score
    });
  });

  describe("completely wrong ordering", () => {
    it("scores zero for reverse chronological order", () => {
      const events = makeEvents([1900, 1950, 2000]);
      const playerOrdering = ["event-2", "event-1", "event-0"]; // reverse

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      expect(result.correctPairs).toBe(0);
      expect(result.perfectPositions).toBe(1); // middle element is still in middle
      expect(result.totalScore).toBe(0);
    });
  });

  describe("partial correctness", () => {
    it("counts partially correct ordering", () => {
      const events = makeEvents([1900, 1950, 2000]);
      // Player: [1950, 1900, 2000] - only (1900<2000) pair is correct
      const playerOrdering = ["event-1", "event-0", "event-2"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      // Pairs: (1,0), (1,2), (0,2)
      // Correct: event-1 comes before event-2 in player (1950<2000 chronologically? NO, 1950<2000 is true)
      // In chronological: [0,1,2], player: [1,0,2]
      // Pair (1,0): player says 1 before 0, chrono says 0 before 1 -> WRONG
      // Pair (1,2): player says 1 before 2, chrono says 1 before 2 -> CORRECT
      // Pair (0,2): player says 0 before 2, chrono says 0 before 2 -> CORRECT
      expect(result.correctPairs).toBe(2);
      expect(result.totalScore).toBe(4);
    });

    it("handles swapped adjacent elements", () => {
      const events = makeEvents([1900, 1950, 2000, 2050]);
      // Only swap first two
      const playerOrdering = ["event-1", "event-0", "event-2", "event-3"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      // 6 total pairs for 4 items
      // Wrong pairs: only (0,1) is swapped
      expect(result.correctPairs).toBe(5); // 6 - 1 = 5
      expect(result.totalScore).toBe(10);
    });
  });

  describe("hints tracking", () => {
    it("passes through hints used count", () => {
      const events = makeEvents([1900, 1950, 2000]);
      const playerOrdering = ["event-0", "event-1", "event-2"];

      const result = scoreOrderSubmission(playerOrdering, events, 3);

      expect(result.hintsUsed).toBe(3);
    });

    it("handles zero hints", () => {
      const events = makeEvents([1900, 1950, 2000]);
      const playerOrdering = ["event-0", "event-1", "event-2"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      expect(result.hintsUsed).toBe(0);
    });
  });

  describe("events not in sorted order in input", () => {
    it("correctly sorts events internally", () => {
      // Events provided out of chronological order
      const events = [
        { id: "c", year: 2000, text: "Event C" },
        { id: "a", year: 1900, text: "Event A" },
        { id: "b", year: 1950, text: "Event B" },
      ];
      // Player gives correct chronological order
      const playerOrdering = ["a", "b", "c"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      expect(result.correctPairs).toBe(3);
      expect(result.perfectPositions).toBe(3);
      expect(result.totalScore).toBe(6);
    });
  });

  describe("edge cases", () => {
    it("handles two events", () => {
      const events = makeEvents([1900, 2000]);
      const playerOrdering = ["event-0", "event-1"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      expect(result.totalPairs).toBe(1);
      expect(result.correctPairs).toBe(1);
      expect(result.totalScore).toBe(2);
    });

    it("handles events with same year (stable sort)", () => {
      const events = [
        { id: "a", year: 1969, text: "Event A" },
        { id: "b", year: 1969, text: "Event B" },
      ];
      const playerOrdering = ["a", "b"];

      const result = scoreOrderSubmission(playerOrdering, events, 0);

      // Both orderings are equally valid since years are same
      expect(result.totalPairs).toBe(1);
    });
  });
});
