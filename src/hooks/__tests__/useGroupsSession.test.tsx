import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "convex/_generated/dataModel";

import { useGroupsSession } from "../useGroupsSession";
import * as helpers from "../lib/groupsSessionHelpers";

vi.mock("../lib/groupsSessionHelpers", () => ({
  GROUPS_SESSION_PREFIX: "chrondle_groups_session_v1_",
  SESSION_TTL_MS: 1000 * 60 * 60 * 24 * 30,
  getEmptyGroupsSessionState: vi.fn(() => ({
    solvedGroupIds: [],
    mistakes: 0,
    remainingMistakes: 4,
    isComplete: false,
    hasWon: false,
    submissions: [],
    revealedGroups: [],
  })),
  readSession: vi.fn(),
  persistSession: vi.fn(),
  pruneStaleSessions: vi.fn(),
}));

describe("useGroupsSession", () => {
  const puzzleId = "groups_puzzle_123" as Id<"groupsPuzzles">;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses stored progress for anonymous players", () => {
    vi.mocked(helpers.readSession).mockReturnValue({
      solvedGroupIds: ["g1"],
      mistakes: 1,
      remainingMistakes: 3,
      isComplete: false,
      hasWon: false,
      submissions: [{ eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 1 }],
      revealedGroups: [{ id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] }],
    });

    const { result } = renderHook(() => useGroupsSession(puzzleId, false));

    expect(result.current.state.solvedGroupIds).toEqual(["g1"]);
    expect(result.current.state.mistakes).toBe(1);
  });

  it("starts empty for authenticated players", () => {
    vi.mocked(helpers.readSession).mockReturnValue({
      solvedGroupIds: ["g1"],
      mistakes: 1,
      remainingMistakes: 3,
      isComplete: false,
      hasWon: false,
      submissions: [{ eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 1 }],
      revealedGroups: [{ id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] }],
    });

    const { result } = renderHook(() => useGroupsSession(puzzleId, true));

    expect(result.current.state).toEqual({
      solvedGroupIds: [],
      mistakes: 0,
      remainingMistakes: 4,
      isComplete: false,
      hasWon: false,
      submissions: [],
      revealedGroups: [],
    });
  });

  it("persists replacements for anonymous players", () => {
    vi.mocked(helpers.readSession).mockReturnValue(null);

    const { result } = renderHook(() => useGroupsSession(puzzleId, false));

    act(() => {
      result.current.replaceProgress({
        solvedGroupIds: ["g1"],
        mistakes: 0,
        remainingMistakes: 4,
        isComplete: false,
        hasWon: false,
        submissions: [{ eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 1 }],
        revealedGroups: [{ id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] }],
      });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(helpers.persistSession).toHaveBeenCalledWith(
      puzzleId,
      expect.objectContaining({
        solvedGroupIds: ["g1"],
      }),
    );
  });

  it("does not persist replacements for authenticated players", () => {
    const { result } = renderHook(() => useGroupsSession(puzzleId, true));

    act(() => {
      result.current.replaceProgress({
        solvedGroupIds: ["g1"],
        mistakes: 0,
        remainingMistakes: 4,
        isComplete: false,
        hasWon: false,
        submissions: [],
        revealedGroups: [],
      });
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(helpers.persistSession).not.toHaveBeenCalled();
  });
});
