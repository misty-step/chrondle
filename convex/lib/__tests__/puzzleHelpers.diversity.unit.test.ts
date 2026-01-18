import { describe, expect, it } from "vitest";
import { selectDiverseEvents, computeDiversityScore } from "../puzzleHelpers";
import type { Doc } from "../../_generated/dataModel";

type EventDoc = Doc<"events">;

/**
 * Creates mock event documents for testing diversity selection.
 * Uses minimal required fields + metadata for diversity testing.
 */
function makeEvent(
  id: string,
  year: number,
  eventText: string,
  metadata?: {
    category?: string[];
    difficulty?: number;
  },
): EventDoc {
  return {
    _id: id as unknown as EventDoc["_id"],
    _creationTime: Date.now(),
    year,
    event: eventText,
    metadata: metadata
      ? {
          category: metadata.category,
          difficulty: metadata.difficulty,
        }
      : undefined,
  } as EventDoc;
}

describe("selectDiverseEvents", () => {
  describe("prevents Augustus-style puzzles", () => {
    it("limits events per category when multiple categories are available", () => {
      // Mix of categories - should pick max 2 from each
      const mixedEvents = [
        makeEvent("1", 27, "Augustus becomes emperor", {
          category: ["Roman History"],
          difficulty: 3,
        }),
        makeEvent("2", 14, "Death of Augustus", { category: ["Roman History"], difficulty: 2 }),
        makeEvent("3", 69, "Year of Four Emperors", { category: ["Roman History"], difficulty: 4 }),
        makeEvent("4", 79, "Eruption of Vesuvius", { category: ["Roman History"], difficulty: 3 }),
        makeEvent("5", 1066, "Battle of Hastings", {
          category: ["Medieval History"],
          difficulty: 3,
        }),
        makeEvent("6", 1215, "Magna Carta", { category: ["Medieval History"], difficulty: 2 }),
        makeEvent("7", 1492, "Columbus voyage", { category: ["Exploration"], difficulty: 2 }),
        makeEvent("8", 1776, "Declaration of Independence", {
          category: ["Political"],
          difficulty: 1,
        }),
      ];

      const selected = selectDiverseEvents(mixedEvents, 6);

      expect(selected.length).toBe(6);

      // Count events per category
      const romanCount = selected.filter(
        (e) => e.metadata?.category?.[0] === "Roman History",
      ).length;
      // Should be limited to 2 because other categories are available
      expect(romanCount).toBeLessThanOrEqual(2);
    });

    it("uses all events from single category when no alternatives exist", () => {
      // All 8 events are about Roman history - no alternatives
      const romanOnlyEvents = [
        makeEvent("1", 27, "Augustus becomes emperor", {
          category: ["Roman History"],
          difficulty: 3,
        }),
        makeEvent("2", 14, "Death of Augustus", { category: ["Roman History"], difficulty: 2 }),
        makeEvent("3", 69, "Year of Four Emperors", { category: ["Roman History"], difficulty: 4 }),
        makeEvent("4", 79, "Eruption of Vesuvius", { category: ["Roman History"], difficulty: 3 }),
        makeEvent("5", 117, "Trajan's conquests", { category: ["Roman History"], difficulty: 4 }),
        makeEvent("6", 180, "Death of Marcus Aurelius", {
          category: ["Roman History"],
          difficulty: 3,
        }),
      ];

      const selected = selectDiverseEvents(romanOnlyEvents, 6);

      // When there's no alternative, use what's available
      expect(selected.length).toBe(6);
    });

    it("distributes selection across multiple categories via round-robin", () => {
      const diverseEvents = [
        makeEvent("1", 1066, "Battle of Hastings", { category: ["Military"], difficulty: 3 }),
        makeEvent("2", 1215, "Magna Carta", { category: ["Political"], difficulty: 2 }),
        makeEvent("3", 1492, "Columbus voyage", { category: ["Exploration"], difficulty: 1 }),
        makeEvent("4", 1776, "Declaration of Independence", {
          category: ["Political"],
          difficulty: 2,
        }),
        makeEvent("5", 1815, "Battle of Waterloo", { category: ["Military"], difficulty: 3 }),
        makeEvent("6", 1859, "Origin of Species", { category: ["Science"], difficulty: 4 }),
        makeEvent("7", 1903, "Wright Brothers flight", { category: ["Science"], difficulty: 2 }),
        makeEvent("8", 1969, "Moon landing", { category: ["Science"], difficulty: 1 }),
      ];

      const selected = selectDiverseEvents(diverseEvents, 6);

      expect(selected.length).toBe(6);

      // Count events per category
      const categoryCounts = new Map<string, number>();
      for (const event of selected) {
        const cat = event.metadata?.category?.[0] ?? "unknown";
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
      }

      // No category should have more than 2 events
      for (const [, count] of categoryCounts) {
        expect(count).toBeLessThanOrEqual(2);
      }

      // Should have at least 3 different categories
      expect(categoryCounts.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe("gracefully handles events without metadata", () => {
    it("uses uncategorized events as fallback when categories exhausted", () => {
      const mixedEvents = [
        makeEvent("1", 1066, "Battle of Hastings", { category: ["Military"], difficulty: 3 }),
        makeEvent("2", 1215, "Magna Carta", { category: ["Political"], difficulty: 2 }),
        makeEvent("3", 1492, "Columbus voyage"), // No metadata
        makeEvent("4", 1776, "Declaration of Independence"), // No metadata
        makeEvent("5", 1815, "Battle of Waterloo"), // No metadata
        makeEvent("6", 1859, "Origin of Species"), // No metadata
      ];

      const selected = selectDiverseEvents(mixedEvents, 6);

      expect(selected.length).toBe(6);
      // Should include all events since we need 6 and only have 6
    });

    it("works with entirely uncategorized events", () => {
      const uncategorizedEvents = [
        makeEvent("1", 1066, "Event 1"),
        makeEvent("2", 1215, "Event 2"),
        makeEvent("3", 1492, "Event 3"),
        makeEvent("4", 1776, "Event 4"),
        makeEvent("5", 1815, "Event 5"),
        makeEvent("6", 1859, "Event 6"),
        makeEvent("7", 1903, "Event 7"),
        makeEvent("8", 1969, "Event 8"),
      ];

      const selected = selectDiverseEvents(uncategorizedEvents, 6);

      expect(selected.length).toBe(6);
    });
  });

  describe("maintains difficulty ordering", () => {
    it("sorts by difficulty descending (hardest hints first)", () => {
      const events = [
        makeEvent("1", 1900, "Easy event", { category: ["A"], difficulty: 1 }),
        makeEvent("2", 1950, "Hard event", { category: ["B"], difficulty: 5 }),
        makeEvent("3", 2000, "Medium event", { category: ["C"], difficulty: 3 }),
        makeEvent("4", 1920, "Very hard event", { category: ["D"], difficulty: 5 }),
        makeEvent("5", 1980, "Medium-hard event", { category: ["E"], difficulty: 4 }),
        makeEvent("6", 1940, "Easy-medium event", { category: ["F"], difficulty: 2 }),
      ];

      const selected = selectDiverseEvents(events, 6);

      // Verify descending difficulty order
      for (let i = 0; i < selected.length - 1; i++) {
        const currDiff = selected[i].metadata?.difficulty ?? 3;
        const nextDiff = selected[i + 1].metadata?.difficulty ?? 3;
        expect(currDiff).toBeGreaterThanOrEqual(nextDiff);
      }
    });

    it("treats missing difficulty as medium (3)", () => {
      const events = [
        makeEvent("1", 1900, "No difficulty", { category: ["A"] }), // Should be treated as 3
        makeEvent("2", 1950, "Hard", { category: ["B"], difficulty: 5 }),
        makeEvent("3", 2000, "Easy", { category: ["C"], difficulty: 1 }),
      ];

      const selected = selectDiverseEvents(events, 3);

      // Hard (5) first, then no-difficulty (3), then Easy (1)
      expect(selected[0].metadata?.difficulty).toBe(5);
      expect(selected[1].metadata?.difficulty).toBeUndefined(); // Treated as 3
      expect(selected[2].metadata?.difficulty).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("returns all events when pool is smaller than requested count", () => {
      const events = [
        makeEvent("1", 1900, "Event 1", { category: ["A"], difficulty: 3 }),
        makeEvent("2", 1950, "Event 2", { category: ["B"], difficulty: 2 }),
      ];

      const selected = selectDiverseEvents(events, 6);

      expect(selected.length).toBe(2);
    });

    it("returns empty array for empty input", () => {
      const selected = selectDiverseEvents([], 6);
      expect(selected.length).toBe(0);
    });

    it("handles count of 0", () => {
      const events = [makeEvent("1", 1900, "Event 1", { category: ["A"] })];
      const selected = selectDiverseEvents(events, 0);
      expect(selected.length).toBe(0);
    });
  });
});

describe("computeDiversityScore", () => {
  describe("category diversity scoring", () => {
    it("returns 1.0 for perfectly diverse puzzle (6 events, 3+ categories)", () => {
      const events = [
        makeEvent("1", 1900, "Event 1", { category: ["Military"] }),
        makeEvent("2", 1920, "Event 2", { category: ["Political"] }),
        makeEvent("3", 1940, "Event 3", { category: ["Science"] }),
        makeEvent("4", 1960, "Event 4", { category: ["Art"] }),
        makeEvent("5", 1980, "Event 5", { category: ["Economics"] }),
        makeEvent("6", 2000, "Event 6", { category: ["Technology"] }),
      ];

      const score = computeDiversityScore(events);

      // 6 categories (>3), 100% coverage = max score
      expect(score).toBe(1.0);
    });

    it("penalizes low category diversity", () => {
      const events = [
        makeEvent("1", 1900, "Event 1", { category: ["Military"] }),
        makeEvent("2", 1920, "Event 2", { category: ["Military"] }),
        makeEvent("3", 1940, "Event 3", { category: ["Military"] }),
        makeEvent("4", 1960, "Event 4", { category: ["Military"] }),
        makeEvent("5", 1980, "Event 5", { category: ["Military"] }),
        makeEvent("6", 2000, "Event 6", { category: ["Military"] }),
      ];

      const score = computeDiversityScore(events);

      // 1 category / 3 target = 0.33 * 0.7 weight + 1.0 coverage * 0.3 = ~0.53
      expect(score).toBeCloseTo(0.533, 2);
    });

    it("scores 0 for empty events array", () => {
      const score = computeDiversityScore([]);
      expect(score).toBe(0);
    });
  });

  describe("metadata coverage scoring", () => {
    it("penalizes events without category metadata", () => {
      const events = [
        makeEvent("1", 1900, "Event 1", { category: ["Military"] }),
        makeEvent("2", 1920, "Event 2", { category: ["Political"] }),
        makeEvent("3", 1940, "Event 3", { category: ["Science"] }),
        makeEvent("4", 1960, "Event 4"), // No metadata
        makeEvent("5", 1980, "Event 5"), // No metadata
        makeEvent("6", 2000, "Event 6"), // No metadata
      ];

      const score = computeDiversityScore(events);

      // 3 categories (= target), 50% coverage
      // 1.0 * 0.7 + 0.5 * 0.3 = 0.85
      expect(score).toBeCloseTo(0.85, 2);
    });

    it("returns low score for all uncategorized events", () => {
      const events = [
        makeEvent("1", 1900, "Event 1"),
        makeEvent("2", 1920, "Event 2"),
        makeEvent("3", 1940, "Event 3"),
      ];

      const score = computeDiversityScore(events);

      // 0 categories, 0% coverage = 0
      expect(score).toBe(0);
    });
  });

  describe("scoring formula", () => {
    it("weights category diversity at 70% and coverage at 30%", () => {
      // 2 categories (2/3 of target), 100% coverage
      const events = [
        makeEvent("1", 1900, "Event 1", { category: ["Military"] }),
        makeEvent("2", 1920, "Event 2", { category: ["Political"] }),
        makeEvent("3", 1940, "Event 3", { category: ["Military"] }),
        makeEvent("4", 1960, "Event 4", { category: ["Political"] }),
      ];

      const score = computeDiversityScore(events);

      // categoryScore = 2/3 = 0.667
      // coverageScore = 4/4 = 1.0
      // total = 0.667 * 0.7 + 1.0 * 0.3 = 0.467 + 0.3 = 0.767
      expect(score).toBeCloseTo(0.767, 2);
    });
  });
});
