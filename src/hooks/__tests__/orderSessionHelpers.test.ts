import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ORDER_SESSION_PREFIX,
  SESSION_TTL_MS,
  getStorageKey,
  normalizeOrdering,
  readSession,
  persistSession,
  pruneStaleSessions,
} from "../lib/orderSessionHelpers";
import type { Id } from "convex/_generated/dataModel";

// Mock logger to avoid console noise
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("orderSessionHelpers", () => {
  const mockPuzzleId = "order_puzzle_123" as Id<"orderPuzzles">;

  describe("getStorageKey", () => {
    it("should generate key with correct prefix", () => {
      const key = getStorageKey(mockPuzzleId);
      expect(key).toBe(`${ORDER_SESSION_PREFIX}${mockPuzzleId}`);
    });
  });

  describe("normalizeOrdering", () => {
    const baseline = ["a", "b", "c", "d"];

    it("should return ordering unchanged when it matches baseline", () => {
      const result = normalizeOrdering(["a", "b", "c", "d"], baseline);
      expect(result).toEqual(["a", "b", "c", "d"]);
    });

    it("should preserve valid reordering", () => {
      const result = normalizeOrdering(["d", "c", "b", "a"], baseline);
      expect(result).toEqual(["d", "c", "b", "a"]);
    });

    it("should remove duplicates", () => {
      const result = normalizeOrdering(["a", "a", "b", "b", "c", "d"], baseline);
      expect(result).toEqual(["a", "b", "c", "d"]);
    });

    it("should filter out items not in baseline", () => {
      const result = normalizeOrdering(["a", "x", "b", "y", "c", "d"], baseline);
      expect(result).toEqual(["a", "b", "c", "d"]);
    });

    it("should append missing baseline items at end", () => {
      const result = normalizeOrdering(["a", "c"], baseline);
      expect(result).toEqual(["a", "c", "b", "d"]);
    });

    it("should handle empty ordering by returning baseline", () => {
      const result = normalizeOrdering([], baseline);
      expect(result).toEqual(["a", "b", "c", "d"]);
    });

    it("should return ordering unchanged when baseline is empty", () => {
      const result = normalizeOrdering(["x", "y", "z"], []);
      expect(result).toEqual(["x", "y", "z"]);
    });

    it("should handle all duplicates and invalids", () => {
      const result = normalizeOrdering(["x", "x", "y", "y"], baseline);
      expect(result).toEqual(["a", "b", "c", "d"]);
    });
  });

  describe("readSession", () => {
    const baseline = ["a", "b", "c"];

    beforeEach(() => {
      localStorage.clear();
    });

    it("should return null when no stored session", () => {
      const result = readSession(mockPuzzleId, baseline);
      expect(result).toBeNull();
    });

    it("should parse valid stored session", () => {
      const stored = {
        ordering: ["c", "b", "a"],
        attempts: [],
        completedAt: null,
        score: null,
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(mockPuzzleId), JSON.stringify(stored));

      const result = readSession(mockPuzzleId, baseline);
      expect(result).toEqual({
        ordering: ["c", "b", "a"],
        attempts: [],
        completedAt: null,
        score: null,
      });
    });

    it("should normalize ordering from stored session", () => {
      const stored = {
        ordering: ["a", "a", "x", "c"], // duplicates and invalid
        attempts: [],
        completedAt: null,
        score: null,
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(mockPuzzleId), JSON.stringify(stored));

      const result = readSession(mockPuzzleId, baseline);
      expect(result?.ordering).toEqual(["a", "c", "b"]); // normalized
    });

    it("should return null on parse error", () => {
      localStorage.setItem(getStorageKey(mockPuzzleId), "invalid json{");

      const result = readSession(mockPuzzleId, baseline);
      expect(result).toBeNull();
    });

    it("should handle missing fields gracefully", () => {
      localStorage.setItem(getStorageKey(mockPuzzleId), JSON.stringify({}));

      const result = readSession(mockPuzzleId, baseline);
      expect(result).toEqual({
        ordering: baseline, // normalized from empty
        attempts: [],
        completedAt: null,
        score: null,
      });
    });

    it("should preserve attempts array", () => {
      const mockAttempt = {
        ordering: ["a", "b", "c"],
        feedback: ["correct", "correct", "correct"],
        pairsCorrect: 3,
        totalPairs: 3,
        timestamp: 123456,
      };
      const stored = {
        ordering: baseline,
        attempts: [mockAttempt],
        completedAt: 789,
        score: { attempts: 1 },
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(mockPuzzleId), JSON.stringify(stored));

      const result = readSession(mockPuzzleId, baseline);
      expect(result?.attempts).toEqual([mockAttempt]);
      expect(result?.completedAt).toBe(789);
      expect(result?.score).toEqual({ attempts: 1 });
    });

    it("should handle non-array attempts", () => {
      const stored = {
        ordering: baseline,
        attempts: "not an array",
        completedAt: null,
        score: null,
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(mockPuzzleId), JSON.stringify(stored));

      const result = readSession(mockPuzzleId, baseline);
      expect(result?.attempts).toEqual([]);
    });

    it("should handle non-number completedAt", () => {
      const stored = {
        ordering: baseline,
        attempts: [],
        completedAt: "not a number",
        score: null,
        updatedAt: Date.now(),
      };
      localStorage.setItem(getStorageKey(mockPuzzleId), JSON.stringify(stored));

      const result = readSession(mockPuzzleId, baseline);
      expect(result?.completedAt).toBeNull();
    });
  });

  describe("persistSession", () => {
    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should store session with updatedAt timestamp", () => {
      const state = {
        ordering: ["a", "b", "c"],
        attempts: [],
        completedAt: null,
        score: null,
      };

      persistSession(mockPuzzleId, state);

      const stored = JSON.parse(localStorage.getItem(getStorageKey(mockPuzzleId))!);
      expect(stored).toEqual({
        ...state,
        updatedAt: Date.now(),
      });
    });

    it("should overwrite existing session", () => {
      const initial = {
        ordering: ["a", "b"],
        attempts: [],
        completedAt: null,
        score: null,
      };
      persistSession(mockPuzzleId, initial);

      const updated = {
        ordering: ["b", "a"],
        attempts: [],
        completedAt: 123,
        score: { attempts: 1 },
      };
      persistSession(mockPuzzleId, updated);

      const stored = JSON.parse(localStorage.getItem(getStorageKey(mockPuzzleId))!);
      expect(stored.ordering).toEqual(["b", "a"]);
      expect(stored.completedAt).toBe(123);
    });
  });

  describe("pruneStaleSessions", () => {
    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should remove sessions older than TTL", () => {
      const now = Date.now();
      const staleTime = now - SESSION_TTL_MS - 1000; // Older than TTL

      const staleKey = `${ORDER_SESSION_PREFIX}stale_puzzle`;
      localStorage.setItem(
        staleKey,
        JSON.stringify({
          ordering: ["a"],
          attempts: [],
          completedAt: null,
          score: null,
          updatedAt: staleTime,
        }),
      );

      pruneStaleSessions();

      expect(localStorage.getItem(staleKey)).toBeNull();
    });

    it("should keep sessions within TTL", () => {
      const now = Date.now();
      const freshTime = now - SESSION_TTL_MS + 1000; // Within TTL

      const freshKey = `${ORDER_SESSION_PREFIX}fresh_puzzle`;
      localStorage.setItem(
        freshKey,
        JSON.stringify({
          ordering: ["a"],
          attempts: [],
          completedAt: null,
          score: null,
          updatedAt: freshTime,
        }),
      );

      pruneStaleSessions();

      expect(localStorage.getItem(freshKey)).not.toBeNull();
    });

    it("should remove sessions without updatedAt", () => {
      const noTimestampKey = `${ORDER_SESSION_PREFIX}no_timestamp`;
      localStorage.setItem(
        noTimestampKey,
        JSON.stringify({
          ordering: ["a"],
          attempts: [],
          completedAt: null,
          score: null,
          // No updatedAt
        }),
      );

      pruneStaleSessions();

      expect(localStorage.getItem(noTimestampKey)).toBeNull();
    });

    it("should remove corrupt entries", () => {
      const corruptKey = `${ORDER_SESSION_PREFIX}corrupt`;
      localStorage.setItem(corruptKey, "invalid json{");

      pruneStaleSessions();

      expect(localStorage.getItem(corruptKey)).toBeNull();
    });

    it("should not touch non-order-session keys", () => {
      const otherKey = "some_other_key";
      localStorage.setItem(otherKey, "some value");

      pruneStaleSessions();

      expect(localStorage.getItem(otherKey)).toBe("some value");
    });

    it("should handle mixed stale and fresh sessions", () => {
      const now = Date.now();
      const staleTime = now - SESSION_TTL_MS - 1000;
      const freshTime = now - SESSION_TTL_MS + 1000;

      const staleKey = `${ORDER_SESSION_PREFIX}stale`;
      const freshKey = `${ORDER_SESSION_PREFIX}fresh`;

      localStorage.setItem(
        staleKey,
        JSON.stringify({
          ordering: [],
          attempts: [],
          completedAt: null,
          score: null,
          updatedAt: staleTime,
        }),
      );
      localStorage.setItem(
        freshKey,
        JSON.stringify({
          ordering: [],
          attempts: [],
          completedAt: null,
          score: null,
          updatedAt: freshTime,
        }),
      );

      pruneStaleSessions();

      expect(localStorage.getItem(staleKey)).toBeNull();
      expect(localStorage.getItem(freshKey)).not.toBeNull();
    });
  });
});
