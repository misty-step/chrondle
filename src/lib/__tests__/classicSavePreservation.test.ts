import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRangeToLocalState,
  readLocalGameState,
  reconcileLocalGameStates,
} from "../gameDataStore";
import { getRangesSnapshot, subscribeToStorage } from "../localStorageSync";
import { gameStateStorage } from "../secureStorage";

const range = { start: 1960, end: 1970, hintsUsed: 2, score: 69, timestamp: 1000 } as const;

beforeEach(() => localStorage.clear());

describe("Classic accepted saves", () => {
  it("retains daily A after archive B and next-day C, including score and hint cost", () => {
    for (const id of ["dailyA", "archiveB", "dailyC"]) {
      expect(addRangeToLocalState(id, range, true, true)).toBe(true);
    }
    for (const id of ["dailyA", "archiveB", "dailyC"]) {
      expect(readLocalGameState(id)).toMatchObject({
        puzzleId: id,
        ranges: [range],
        isComplete: true,
        hasWon: true,
      });
      expect(getRangesSnapshot(id)).toEqual([range]);
    }
  });

  it("preserves a legacy singleton when another puzzle is accepted", () => {
    localStorage.setItem(
      "chrondle-game-state",
      JSON.stringify({
        puzzleId: "legacyA",
        guesses: [],
        ranges: [range],
        isComplete: true,
        hasWon: true,
        timestamp: 1000,
      }),
    );
    addRangeToLocalState("archiveB", range, true, true);
    expect(readLocalGameState("legacyA")?.ranges).toEqual([range]);
    expect(readLocalGameState("archiveB")?.ranges).toEqual([range]);
  });

  it("notifies subscribers for the real hyphenated legacy key and browser clear", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToStorage(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "chrondle-game-state" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite completed accepted attempts when another tab retries", () => {
    addRangeToLocalState("dailyA", range, true, true);
    addRangeToLocalState("dailyA", { ...range, timestamp: 2000 }, true, true);
    expect(readLocalGameState("dailyA")?.ranges).toEqual([range]);
    expect(gameStateStorage.get("dailyA")?.isComplete).toBe(true);
  });
});

describe("sign-in reconciliation", () => {
  it("reconciles every puzzle and retains rejected/unacknowledged saves", async () => {
    for (const id of ["A", "B", "C"]) addRangeToLocalState(id, range, true, true);
    const merge = vi.fn(async (state) => ({ success: state.puzzleId !== "B" }));
    await reconcileLocalGameStates(merge);
    expect(merge.mock.calls.map(([state]) => state.puzzleId)).toEqual(["A", "B", "C"]);
    expect(readLocalGameState("A")).toBeNull();
    expect(readLocalGameState("B")?.ranges).toEqual([range]);
    expect(readLocalGameState("C")).toBeNull();
  });

  it("retains data through network failure and acknowledgement loss", async () => {
    addRangeToLocalState("A", range, true, true);
    const accepted = new Set<string>();
    const merge = vi.fn(async (state) => {
      accepted.add(state.puzzleId);
      if (merge.mock.calls.length === 1) throw new Error("acknowledgement lost");
      return { success: true };
    });
    await reconcileLocalGameStates(merge);
    expect(readLocalGameState("A")?.ranges).toEqual([range]);
    await reconcileLocalGameStates(merge);
    expect(accepted.size).toBe(1);
    expect(readLocalGameState("A")).toBeNull();
  });

  it("does not clear a snapshot changed while awaiting the server", async () => {
    addRangeToLocalState("A", range, true, true);
    await reconcileLocalGameStates(async () => {
      gameStateStorage.set({
        puzzleId: "A",
        guesses: [1900],
        ranges: [range],
        isComplete: true,
        hasWon: true,
        timestamp: 3000,
      });
      return { success: true };
    });
    expect(readLocalGameState("A")?.guesses).toEqual([1900]);
  });

  it("retains the singleton if copying into per-puzzle storage fails", async () => {
    localStorage.setItem(
      "chrondle-game-state",
      JSON.stringify({
        puzzleId: "legacyA",
        guesses: [],
        ranges: [range],
        isComplete: true,
        hasWon: true,
        timestamp: 1000,
      }),
    );
    const original = localStorage.setItem;
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key.startsWith("chrondle-game-state-puzzle-")) throw new Error("quota");
      original.call(this, key, value);
    });
    await gameStateStorage.migrateLegacy();
    expect(readLocalGameState("legacyA")?.ranges).toEqual([range]);
    expect(localStorage.getItem("chrondle-game-state")).not.toBeNull();
    spy.mockRestore();
  });
});

it("serializes reconciliation cleanup with an in-flight accepted save from another tab", async () => {
  const { withClassicSaveLock } = await import("../classicSaveLock");
  let queue = Promise.resolve();
  const request = vi.fn((_name: string, operation: () => unknown) => {
    const work = queue.then(operation);
    queue = work.then(() => undefined);
    return work;
  });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
  let release = () => {};
  let entered = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    gameStateStorage.set({
      puzzleId: "A",
      guesses: [1900],
      ranges: [],
      isComplete: false,
      hasWon: false,
      timestamp: 1000,
    });
    const writer = withClassicSaveLock("A", async () => {
      entered();
      await held;
      addRangeToLocalState("A", range, true, true);
    });
    await started;
    const reconciliation = reconcileLocalGameStates(async () => ({ success: true }));
    await Promise.resolve();
    release();
    await Promise.all([writer, reconciliation]);
    expect(readLocalGameState("A")?.ranges).toEqual([range]);
    expect(readLocalGameState("A")?.guesses).toEqual([1900]);
    expect(request.mock.calls.every(([name]) => name === "chrondle-classic-A")).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    Reflect.deleteProperty(navigator, "locks");
  }
});
