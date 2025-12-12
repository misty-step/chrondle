import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  subscribeToStorage,
  getStorageSnapshot,
  getServerSnapshot,
  updateStorage,
  clearStorage,
} from "../localStorageSync";

/**
 * LocalStorage Sync Tests
 *
 * Deep module pattern: Mock the gameStateStorage boundary,
 * test public interface behavior.
 */

// Mock the secureStorage module
vi.mock("../secureStorage", () => ({
  gameStateStorage: {
    get: vi.fn(),
    set: vi.fn(() => true),
    remove: vi.fn(),
  },
}));

import { gameStateStorage } from "../secureStorage";

const mockedGameStateStorage = vi.mocked(gameStateStorage);

describe("localStorageSync", () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window with event listeners
    Object.defineProperty(global, "window", {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
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

  describe("subscribeToStorage", () => {
    it("adds storage and custom event listeners", () => {
      const callback = vi.fn();
      const addEventSpy = vi.spyOn(window, "addEventListener");

      subscribeToStorage(callback);

      expect(addEventSpy).toHaveBeenCalledWith("storage", expect.any(Function));
      expect(addEventSpy).toHaveBeenCalledWith("chrondle-storage-change", expect.any(Function));
    });

    it("returns unsubscribe function that removes listeners", () => {
      const callback = vi.fn();
      const removeEventSpy = vi.spyOn(window, "removeEventListener");

      const unsubscribe = subscribeToStorage(callback);
      unsubscribe();

      expect(removeEventSpy).toHaveBeenCalledWith("storage", expect.any(Function));
      expect(removeEventSpy).toHaveBeenCalledWith("chrondle-storage-change", expect.any(Function));
    });

    it("calls callback on storage event for correct key", () => {
      const callback = vi.fn();
      let capturedHandler: ((e: StorageEvent) => void) | undefined;

      vi.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
        if (event === "storage") {
          capturedHandler = handler as (e: StorageEvent) => void;
        }
      });

      subscribeToStorage(callback);

      // Simulate storage event with correct key
      const event = { key: "chrondle_game_state" } as StorageEvent;
      capturedHandler?.(event);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("ignores storage events for other keys", () => {
      const callback = vi.fn();
      let capturedHandler: ((e: StorageEvent) => void) | undefined;

      vi.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
        if (event === "storage") {
          capturedHandler = handler as (e: StorageEvent) => void;
        }
      });

      subscribeToStorage(callback);

      // Simulate storage event with different key
      const event = { key: "other_key" } as StorageEvent;
      capturedHandler?.(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it("calls callback on custom storage change event", () => {
      const callback = vi.fn();
      let capturedHandler: (() => void) | undefined;

      vi.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
        if (event === "chrondle-storage-change") {
          capturedHandler = handler as () => void;
        }
      });

      subscribeToStorage(callback);
      capturedHandler?.();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStorageSnapshot", () => {
    it("returns empty array for null puzzleId", () => {
      const result = getStorageSnapshot(null);
      expect(result).toEqual([]);
    });

    it("returns empty array during SSR (no window)", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = getStorageSnapshot("puzzle-1");
      expect(result).toEqual([]);
    });

    it("returns guesses from storage for matching puzzleId", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776, 1789, 1815],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = getStorageSnapshot("puzzle-1");
      expect(result).toEqual([1776, 1789, 1815]);
    });

    it("returns empty array when storage puzzleId does not match", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-2",
        guesses: [1776],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result = getStorageSnapshot("puzzle-1");
      expect(result).toEqual([]);
    });

    it("returns empty array when storage returns null", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      const result = getStorageSnapshot("puzzle-1");
      expect(result).toEqual([]);
    });

    it("handles missing guesses array", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: undefined,
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      } as any);

      const result = getStorageSnapshot("puzzle-1");
      expect(result).toEqual([]);
    });

    it("caches results for repeated calls with same puzzleId", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      const result1 = getStorageSnapshot("puzzle-1");
      const result2 = getStorageSnapshot("puzzle-1");

      // Same reference returned (cached)
      expect(result1).toBe(result2);
    });
  });

  describe("getServerSnapshot", () => {
    it("always returns empty array", () => {
      const result = getServerSnapshot();
      expect(result).toEqual([]);
    });

    it("returns frozen empty array", () => {
      const result = getServerSnapshot();
      expect(Object.isFrozen(result)).toBe(true);
    });

    it("returns same reference on multiple calls", () => {
      const result1 = getServerSnapshot();
      const result2 = getServerSnapshot();
      expect(result1).toBe(result2);
    });
  });

  describe("updateStorage", () => {
    it("sets game state via gameStateStorage", () => {
      updateStorage("puzzle-1", [1776, 1789]);

      expect(mockedGameStateStorage.set).toHaveBeenCalledWith({
        puzzleId: "puzzle-1",
        guesses: [1776, 1789],
        isComplete: false,
        hasWon: false,
        timestamp: expect.any(Number),
      });
    });

    it("sets isComplete and hasWon when provided", () => {
      updateStorage("puzzle-1", [1776], true, true);

      expect(mockedGameStateStorage.set).toHaveBeenCalledWith({
        puzzleId: "puzzle-1",
        guesses: [1776],
        isComplete: true,
        hasWon: true,
        timestamp: expect.any(Number),
      });
    });

    it("dispatches custom event on successful set", () => {
      const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

      updateStorage("puzzle-1", [1776]);

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
      const event = dispatchEventSpy.mock.calls[0][0] as Event;
      expect(event.type).toBe("chrondle-storage-change");
    });

    it("does not dispatch event when set fails", () => {
      mockedGameStateStorage.set.mockReturnValue(false);
      const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

      updateStorage("puzzle-1", [1776]);

      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });
  });

  describe("clearStorage", () => {
    it("removes storage when puzzleId matches", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [1776],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      clearStorage("puzzle-1");

      expect(mockedGameStateStorage.remove).toHaveBeenCalled();
    });

    it("does not remove storage when puzzleId does not match", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-2",
        guesses: [1776],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });

      clearStorage("puzzle-1");

      expect(mockedGameStateStorage.remove).not.toHaveBeenCalled();
    });

    it("does not remove storage when no state exists", () => {
      mockedGameStateStorage.get.mockReturnValue(null);

      clearStorage("puzzle-1");

      expect(mockedGameStateStorage.remove).not.toHaveBeenCalled();
    });

    it("dispatches custom event when clearing matching puzzle", () => {
      mockedGameStateStorage.get.mockReturnValue({
        puzzleId: "puzzle-1",
        guesses: [],
        isComplete: false,
        hasWon: false,
        timestamp: Date.now(),
      });
      const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");

      clearStorage("puzzle-1");

      expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
    });
  });
});
