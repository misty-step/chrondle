import { describe, expect, it } from "vitest";

import {
  applyGroupsSelection,
  evaluateGroupSelection,
  MAX_GROUPS_MISTAKES,
  type GroupsPuzzleGroup,
  type GroupsSubmissionRecord,
} from "../engine";

const GROUPS: GroupsPuzzleGroup[] = [
  { id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] },
  { id: "g2", year: 1776, tier: "medium", eventIds: ["e", "f", "g", "h"] },
  { id: "g3", year: 1453, tier: "hard", eventIds: ["i", "j", "k", "l"] },
  { id: "g4", year: -44, tier: "very hard", eventIds: ["m", "n", "o", "p"] },
];

const BOARD_EVENT_IDS = GROUPS.flatMap((group) => group.eventIds);

describe("groups engine", () => {
  it("evaluates an exact match as solved", () => {
    expect(evaluateGroupSelection(GROUPS, ["d", "c", "b", "a"])).toEqual({
      result: "solved",
      matchedGroupId: "g1",
      revealedYear: 1969,
      revealedTier: "easy",
    });
  });

  it("applies a local solved selection and reveals only the solved group", () => {
    const result = applyGroupsSelection({
      groups: GROUPS,
      boardEventIds: BOARD_EVENT_IDS,
      solvedGroupIds: [],
      submissions: [],
      eventIds: ["d", "c", "b", "a"],
      timestamp: 123,
    });

    expect(result.outcome).toEqual({
      result: "solved",
      matchedGroupId: "g1",
      revealedYear: 1969,
      revealedTier: "easy",
    });
    expect(result.progress.mistakes).toBe(0);
    expect(result.progress.isComplete).toBe(false);
    expect(result.progress.revealedGroups).toEqual([
      { id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] },
    ]);
  });

  it("reveals the full board after the fourth mistake", () => {
    const priorSubmissions: GroupsSubmissionRecord[] = Array.from({
      length: MAX_GROUPS_MISTAKES - 1,
    })
      .fill(null)
      .map((_, index) => ({
        eventIds: ["a", "b", "e", "f"],
        result: "miss" as const,
        timestamp: index + 1,
      }));

    const result = applyGroupsSelection({
      groups: GROUPS,
      boardEventIds: BOARD_EVENT_IDS,
      solvedGroupIds: [],
      submissions: priorSubmissions,
      eventIds: ["a", "b", "e", "f"],
      timestamp: 999,
    });

    expect(result.outcome).toEqual({ result: "miss" });
    expect(result.progress.mistakes).toBe(MAX_GROUPS_MISTAKES);
    expect(result.progress.isComplete).toBe(true);
    expect(result.progress.hasWon).toBe(false);
    expect(result.progress.revealedGroups).toHaveLength(4);
  });

  it("rejects submissions that reuse already solved cards", () => {
    expect(() =>
      applyGroupsSelection({
        groups: GROUPS,
        boardEventIds: BOARD_EVENT_IDS,
        solvedGroupIds: ["g1"],
        submissions: [],
        eventIds: ["a", "b", "e", "f"],
        timestamp: 1,
      }),
    ).toThrow("Solved cards cannot be submitted again.");
  });
});
