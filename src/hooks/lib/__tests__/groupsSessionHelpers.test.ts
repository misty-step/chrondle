/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "convex/_generated/dataModel";

import {
  getStorageKey,
  GROUPS_SESSION_PREFIX,
  persistSession,
  pruneStaleSessions,
  readSession,
  SESSION_TTL_MS,
  type GroupsSessionState,
} from "../groupsSessionHelpers";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("groupsSessionHelpers", () => {
  const puzzleId = "groups-puzzle" as Id<"groupsPuzzles">;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("prefixes the puzzle id in the storage key", () => {
    expect(getStorageKey(puzzleId)).toBe(`${GROUPS_SESSION_PREFIX}groups-puzzle`);
  });

  it("returns null when no stored session exists", () => {
    expect(readSession(puzzleId)).toBeNull();
  });

  it("reads stored progress from localStorage", () => {
    const stored: GroupsSessionState = {
      solvedGroupIds: ["g1"],
      mistakes: 1,
      remainingMistakes: 3,
      isComplete: false,
      hasWon: false,
      submissions: [{ eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 1 }],
      revealedGroups: [{ id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] }],
    };

    persistSession(puzzleId, stored);

    expect(readSession(puzzleId)).toEqual(stored);
  });

  it("falls back to empty progress when stored data is partial", () => {
    localStorage.setItem(getStorageKey(puzzleId), JSON.stringify({ mistakes: 2 }));

    expect(readSession(puzzleId)).toEqual({
      solvedGroupIds: [],
      mistakes: 2,
      remainingMistakes: 2,
      isComplete: false,
      hasWon: false,
      submissions: [],
      revealedGroups: [],
    });
  });

  it("persists updatedAt metadata", () => {
    const state: GroupsSessionState = {
      solvedGroupIds: [],
      mistakes: 0,
      remainingMistakes: 4,
      isComplete: false,
      hasWon: false,
      submissions: [],
      revealedGroups: [],
    };

    persistSession(puzzleId, state);

    const stored = JSON.parse(localStorage.getItem(getStorageKey(puzzleId)) ?? "{}");
    expect(stored.updatedAt).toBe(Date.now());
  });

  it("removes stale sessions", () => {
    localStorage.setItem(
      getStorageKey("old-groups" as Id<"groupsPuzzles">),
      JSON.stringify({
        solvedGroupIds: [],
        mistakes: 0,
        remainingMistakes: 4,
        isComplete: false,
        hasWon: false,
        submissions: [],
        revealedGroups: [],
        updatedAt: Date.now() - SESSION_TTL_MS - 1,
      }),
    );

    pruneStaleSessions();

    expect(localStorage.length).toBe(0);
  });
});
