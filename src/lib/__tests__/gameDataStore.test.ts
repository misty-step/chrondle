import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  readLocalGameState,
  writeLocalGameState,
  addRangeToLocalState,
  updateLastRangeInLocalState,
  removeLastRangeFromLocalState,
  clearLocalGameState,
  getMigrationData,
  hasLocalGameState,
  hasLocalGameStateForPuzzle,
  validateRanges,
} from "../gameDataStore";
import type { RangeGuess } from "@/types/range";

/**
 * Game Data Store Tests
 *
 * Tests the auth-agnostic local data layer.
 * Mocks gameStateStorage from secureStorage.
 */

vi.mock("../secureStorage", () => ({
  gameStateStorage: {
    get: vi.fn(),
    set: vi.fn(() => true),
    remove: vi.fn(() => true),
    exists: vi.fn(() => false),
  },
  rangeGuessSchema: {
    // Minimal Zod-like schema for testing
  },
}));

// Mock zod for validateRanges
vi.mock("zod", () => ({
  z: {
    array: vi.fn(() => ({
      parse: vi.fn((input) => {
        if (!Array.isArray(input)) throw new Error("Invalid");
        return input;
      }),
    })),
  },
}));

import { gameStateStorage } from "../secureStorage";

const mockedGameStateStorage = vi.mocked(gameStateStorage);

const createMockRange = (start: number, end: number): RangeGuess => ({
  start,
  end,
  hintsUsed: 0 as const,
  score: 100,
  timestamp: Date.now(),
});

describe("gameDataStore", () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global, "window", {
      value: {
        dispatchEvent: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe("readLocalGameState", () => {
    it("returns null during SSR", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = readLocalGameState();
      expect(result).toBeNull();
    });

    it("returns null when storage is empty", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      const result = readLocalGameState();
      expect(result).toBeNull();
    });

    it("returns state when no puzzleId filter provided", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = readLocalGameState();
      expect(result).not.toBeNull();
      expect(result?.puzzleId).toBe("puzzle-1");
    });

    it("returns state when puzzleId matches", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = readLocalGameState("puzzle-1");
      expect(result).not.toBeNull();
    });

    it("returns null when puzzleId does not match", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-2",
        guesses: [1776],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = readLocalGameState("puzzle-1");
      expect(result).toBeNull();
    });

    it("normalizes missing ranges to empty array", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        ranges: undefined,
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = readLocalGameState();
      expect(result?.ranges).toEqual([]);
    });
  });

  describe("writeLocalGameState", () => {
    it("returns false during SSR", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = writeLocalGameState({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      expect(result).toBe(false);
    });

    it("writes state and dispatches event on success", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      const result = writeLocalGameState({
        puzzleId: "puzzle-1",
        guesses: [1776],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      expect(result).toBe(true);
      expect(mockedGameStateStorage.set).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    });

    it("does not dispatch event when write fails", () => {
      mockedGameStateStorage.set.mockReturnValue(false);
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      writeLocalGameState({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe("addRangeToLocalState", () => {
    it("creates new state when none exists", () => {
      mockedGameStateStorage.get.mockReturnValue(null);
      const range = createMockRange(1750, 1800);

      addRangeToLocalState("puzzle-1", range, false, false);

      expect(mockedGameStateStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          puzzleId: "puzzle-1",
          ranges: [range],
        }),
      );
    });

    it("appends range to existing state", () => {
      const existingRange = createMockRange(1700, 1750);
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [existingRange],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const newRange = createMockRange(1750, 1800);
      addRangeToLocalState("puzzle-1", newRange, true, true);

      expect(mockedGameStateStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ranges: [existingRange, newRange],
          isComplete: true,
          hasWon: true,
        }),
      );
    });
  });

  describe("updateLastRangeInLocalState", () => {
    it("returns false when no state exists", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      const result = updateLastRangeInLocalState("puzzle-1", createMockRange(1750, 1800));
      expect(result).toBe(false);
    });

    it("returns false when no ranges exist", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = updateLastRangeInLocalState("puzzle-1", createMockRange(1750, 1800));
      expect(result).toBe(false);
    });

    it("updates last range when ranges exist", () => {
      const oldRange = createMockRange(1700, 1750);
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [oldRange],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const newRange = createMockRange(1750, 1800);
      updateLastRangeInLocalState("puzzle-1", newRange);

      expect(mockedGameStateStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ranges: [newRange],
        }),
      );
    });
  });

  describe("removeLastRangeFromLocalState", () => {
    it("returns false when no state exists", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      const result = removeLastRangeFromLocalState("puzzle-1");
      expect(result).toBe(false);
    });

    it("removes last range from state", () => {
      const range1 = createMockRange(1700, 1750);
      const range2 = createMockRange(1750, 1800);
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [range1, range2],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      removeLastRangeFromLocalState("puzzle-1");

      expect(mockedGameStateStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ranges: [range1],
        }),
      );
    });
  });

  describe("clearLocalGameState", () => {
    it("returns false during SSR", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = clearLocalGameState();
      expect(result).toBe(false);
    });

    it("removes state and dispatches event", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      const result = clearLocalGameState();

      expect(result).toBe(true);
      expect(mockedGameStateStorage.remove).toHaveBeenCalled();
      expect(dispatchSpy).toHaveBeenCalled();
    });
  });

  describe("getMigrationData", () => {
    it("returns null during SSR", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = getMigrationData();
      expect(result).toBeNull();
    });

    it("returns null when storage is empty", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      const result = getMigrationData();
      expect(result).toBeNull();
    });

    it("returns null when no guesses or ranges", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = getMigrationData();
      expect(result).toBeNull();
    });

    it("returns migration data when guesses exist", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = getMigrationData();
      expect(result).not.toBeNull();
      expect(result?.puzzleId).toBe("puzzle-1");
      expect(result?.guesses).toEqual([1776]);
    });

    it("returns migration data when ranges exist", () => {
      const range = createMockRange(1750, 1800);
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [range],
        isComplete: true,
        hasWon: true,
        timestamp: Date.now(),
      });

      const result = getMigrationData();
      expect(result).not.toBeNull();
      expect(result?.ranges).toEqual([range]);
      expect(result?.isComplete).toBe(true);
    });
  });

  describe("hasLocalGameState", () => {
    it("returns false during SSR", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = hasLocalGameState();
      expect(result).toBe(false);
    });

    it("returns result from gameStateStorage.exists", () => {
      mockedGameStateStorage.exists.mockReturnValue(true);

      const result = hasLocalGameState();
      expect(result).toBe(true);
    });
  });

  describe("hasLocalGameStateForPuzzle", () => {
    it("returns false when no state exists", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      const result = hasLocalGameStateForPuzzle("puzzle-1");
      expect(result).toBe(false);
    });

    it("returns false when state has no data", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = hasLocalGameStateForPuzzle("puzzle-1");
      expect(result).toBe(false);
    });

    it("returns true when state has guesses", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        ranges: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = hasLocalGameStateForPuzzle("puzzle-1");
      expect(result).toBe(true);
    });

    it("returns true when state has ranges", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        ranges: [createMockRange(1750, 1800)],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = hasLocalGameStateForPuzzle("puzzle-1");
      expect(result).toBe(true);
    });
  });

  describe("validateRanges", () => {
    it("returns valid array input", () => {
      const ranges = [createMockRange(1750, 1800)];
      const result = validateRanges(ranges);
      expect(result).toEqual(ranges);
    });

    it("returns empty array for invalid input", () => {
      const result = validateRanges("invalid");
      expect(result).toEqual([]);
    });
  });
});
