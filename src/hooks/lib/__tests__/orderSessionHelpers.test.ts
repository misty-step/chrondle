/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStorageKey,
  normalizeOrdering,
  readSession,
  persistSession,
  pruneStaleSessions,
  ORDER_SESSION_PREFIX,
  SESSION_TTL_MS,
  type OrderSessionState,
} from "../orderSessionHelpers";
import type { Id } from "convex/_generated/dataModel";

// Mock logger to prevent console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("orderSessionHelpers", () => {
  describe("getStorageKey", () => {
    it("prefixes puzzle ID with session prefix", () => {
      const puzzleId = "abc123" as Id<"orderPuzzles">;
      const key = getStorageKey(puzzleId);
      expect(key).toBe(`${ORDER_SESSION_PREFIX}abc123`);
    });

    it("handles different puzzle IDs", () => {
      const id1 = getStorageKey("puzzle1" as Id<"orderPuzzles">);
      const id2 = getStorageKey("puzzle2" as Id<"orderPuzzles">);
      expect(id1).not.toBe(id2);
    });
  });

  describe("normalizeOrdering", () => {
    it("returns empty array when ordering is empty", () => {
      const result = normalizeOrdering([], ["a", "b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("returns ordering unchanged when it matches baseline exactly", () => {
      const result = normalizeOrdering(["a", "b", "c"], ["a", "b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("preserves ordering when all items are in baseline", () => {
      const result = normalizeOrdering(["c", "a", "b"], ["a", "b", "c"]);
      expect(result).toEqual(["c", "a", "b"]);
    });

    it("removes items not in baseline", () => {
      const result = normalizeOrdering(["a", "x", "b", "y"], ["a", "b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("appends missing baseline items at the end", () => {
      const result = normalizeOrdering(["b"], ["a", "b", "c"]);
      expect(result).toEqual(["b", "a", "c"]);
    });

    it("removes duplicate items", () => {
      const result = normalizeOrdering(["a", "a", "b", "b"], ["a", "b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("returns ordering unchanged when baseline is empty", () => {
      const result = normalizeOrdering(["a", "b"], []);
      expect(result).toEqual(["a", "b"]);
    });

    it("handles completely foreign ordering", () => {
      const result = normalizeOrdering(["x", "y", "z"], ["a", "b", "c"]);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("handles mixed valid and invalid items", () => {
      const result = normalizeOrdering(["c", "x", "a", "y", "b"], ["a", "b", "c"]);
      expect(result).toEqual(["c", "a", "b"]);
    });

    it("preserves order of first occurrence when duplicates exist", () => {
      const result = normalizeOrdering(["b", "a", "b", "a"], ["a", "b", "c"]);
      expect(result).toEqual(["b", "a", "c"]);
    });
  });

  describe("readSession", () => {
    const puzzleId = "test-puzzle" as Id<"orderPuzzles">;
    const baseline = ["event1", "event2", "event3"];

    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it("returns null when no stored session", () => {
      const result = readSession(puzzleId, baseline);
      expect(result).toBeNull();
    });

    it("reads and parses stored session", () => {
      const storedSession = {
        ordering: ["event2", "event1", "event3"],
        attempts: [{ correct: ["event1"], incorrect: ["event2"] }],
        completedAt: 1700000000000,
        score: { totalScore: 100, attemptsUsed: 2 },
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(puzzleId), JSON.stringify(storedSession));

      const result = readSession(puzzleId, baseline);

      expect(result).not.toBeNull();
      expect(result?.ordering).toEqual(["event2", "event1", "event3"]);
      expect(result?.completedAt).toBe(1700000000000);
    });

    it("normalizes ordering from stored session", () => {
      const storedSession = {
        ordering: ["event3", "invalid", "event1"],
        attempts: [],
        completedAt: null,
        score: null,
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(puzzleId), JSON.stringify(storedSession));

      const result = readSession(puzzleId, baseline);

      // Should normalize: keep valid items, append missing
      expect(result?.ordering).toEqual(["event3", "event1", "event2"]);
    });

    it("returns null for malformed JSON", () => {
      localStorage.setItem(getStorageKey(puzzleId), "not valid json{");

      const result = readSession(puzzleId, baseline);

      expect(result).toBeNull();
    });

    it("handles missing fields gracefully", () => {
      localStorage.setItem(getStorageKey(puzzleId), JSON.stringify({}));

      const result = readSession(puzzleId, baseline);

      expect(result).not.toBeNull();
      expect(result?.ordering).toEqual(baseline);
      expect(result?.attempts).toEqual([]);
      expect(result?.completedAt).toBeNull();
      expect(result?.score).toBeNull();
    });

    it("validates completedAt as number", () => {
      localStorage.setItem(
        getStorageKey(puzzleId),
        JSON.stringify({ completedAt: "not a number" }),
      );

      const result = readSession(puzzleId, baseline);

      expect(result?.completedAt).toBeNull();
    });

    it("validates attempts as array", () => {
      localStorage.setItem(getStorageKey(puzzleId), JSON.stringify({ attempts: "not an array" }));

      const result = readSession(puzzleId, baseline);

      expect(result?.attempts).toEqual([]);
    });
  });

  describe("persistSession", () => {
    const puzzleId = "persist-test" as Id<"orderPuzzles">;

    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      localStorage.clear();
      vi.useRealTimers();
    });

    it("stores session in localStorage", () => {
      const state: OrderSessionState = {
        ordering: ["a", "b", "c"],
        attempts: [],
        completedAt: null,
        score: null,
      };

      persistSession(puzzleId, state);

      const stored = localStorage.getItem(getStorageKey(puzzleId));
      expect(stored).not.toBeNull();
    });

    it("adds updatedAt timestamp", () => {
      const state: OrderSessionState = {
        ordering: ["a", "b", "c"],
        attempts: [],
        completedAt: null,
        score: null,
      };

      persistSession(puzzleId, state);

      const stored = JSON.parse(localStorage.getItem(getStorageKey(puzzleId))!);
      expect(stored.updatedAt).toBe(Date.now());
    });

    it("preserves all state fields", () => {
      const state: OrderSessionState = {
        ordering: ["c", "b", "a"],
        attempts: [
          {
            ordering: ["a", "b", "c"],
            feedback: ["correct", "correct", "correct"],
            pairsCorrect: 2,
            totalPairs: 2,
            timestamp: 1700000000000,
          },
        ],
        completedAt: 1700000000000,
        score: { attempts: 1 },
      };

      persistSession(puzzleId, state);

      const stored = JSON.parse(localStorage.getItem(getStorageKey(puzzleId))!);
      expect(stored.ordering).toEqual(["c", "b", "a"]);
      expect(stored.completedAt).toBe(1700000000000);
      expect(stored.score).toEqual({ attempts: 1 });
    });

    it("overwrites existing session", () => {
      const state1: OrderSessionState = {
        ordering: ["a"],
        attempts: [],
        completedAt: null,
        score: null,
      };
      const state2: OrderSessionState = {
        ordering: ["b"],
        attempts: [],
        completedAt: null,
        score: null,
      };

      persistSession(puzzleId, state1);
      persistSession(puzzleId, state2);

      const stored = JSON.parse(localStorage.getItem(getStorageKey(puzzleId))!);
      expect(stored.ordering).toEqual(["b"]);
    });
  });

  describe("pruneStaleSessions", () => {
    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
    });

    afterEach(() => {
      localStorage.clear();
      vi.useRealTimers();
    });

    it("removes sessions older than TTL", () => {
      const oldSession = {
        ordering: ["a"],
        attempts: [],
        completedAt: null,
        score: null,
        updatedAt: Date.now() - SESSION_TTL_MS - 1000, // Older than TTL
      };
      localStorage.setItem(`${ORDER_SESSION_PREFIX}old-puzzle`, JSON.stringify(oldSession));

      pruneStaleSessions();

      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}old-puzzle`)).toBeNull();
    });

    it("keeps sessions within TTL", () => {
      const recentSession = {
        ordering: ["a"],
        attempts: [],
        completedAt: null,
        score: null,
        updatedAt: Date.now() - 1000, // Very recent
      };
      localStorage.setItem(`${ORDER_SESSION_PREFIX}recent-puzzle`, JSON.stringify(recentSession));

      pruneStaleSessions();

      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}recent-puzzle`)).not.toBeNull();
    });

    it("removes corrupt sessions", () => {
      localStorage.setItem(`${ORDER_SESSION_PREFIX}corrupt-puzzle`, "not valid json{");

      pruneStaleSessions();

      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}corrupt-puzzle`)).toBeNull();
    });

    it("removes sessions without updatedAt", () => {
      localStorage.setItem(
        `${ORDER_SESSION_PREFIX}no-timestamp`,
        JSON.stringify({ ordering: ["a"] }),
      );

      pruneStaleSessions();

      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}no-timestamp`)).toBeNull();
    });

    it("does not touch non-session keys", () => {
      localStorage.setItem("other-key", "some value");
      localStorage.setItem("chrondle_different_prefix", "another value");

      pruneStaleSessions();

      expect(localStorage.getItem("other-key")).toBe("some value");
      expect(localStorage.getItem("chrondle_different_prefix")).toBe("another value");
    });

    it("handles multiple sessions correctly", () => {
      const old = {
        updatedAt: Date.now() - SESSION_TTL_MS - 1000,
      };
      const recent = {
        updatedAt: Date.now() - 1000,
      };

      localStorage.setItem(`${ORDER_SESSION_PREFIX}old1`, JSON.stringify(old));
      localStorage.setItem(`${ORDER_SESSION_PREFIX}recent1`, JSON.stringify(recent));
      localStorage.setItem(`${ORDER_SESSION_PREFIX}old2`, JSON.stringify(old));
      localStorage.setItem(`${ORDER_SESSION_PREFIX}recent2`, JSON.stringify(recent));

      pruneStaleSessions();

      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}old1`)).toBeNull();
      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}old2`)).toBeNull();
      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}recent1`)).not.toBeNull();
      expect(localStorage.getItem(`${ORDER_SESSION_PREFIX}recent2`)).not.toBeNull();
    });
  });

  describe("constants", () => {
    it("exports correct session prefix", () => {
      expect(ORDER_SESSION_PREFIX).toBe("chrondle_order_session_v2_");
    });

    it("exports correct TTL (30 days)", () => {
      const thirtyDaysMs = 1000 * 60 * 60 * 24 * 30;
      expect(SESSION_TTL_MS).toBe(thirtyDaysMs);
    });
  });
});
