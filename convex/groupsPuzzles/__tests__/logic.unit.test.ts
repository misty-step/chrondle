import { describe, expect, it } from "vitest";

import {
  countMistakes,
  evaluateGroupSelection,
  isGroupsPuzzleComplete,
  validateCompletedGroupsPlay,
  type GroupsPuzzleGroup,
  type GroupsSubmissionRecord,
} from "../logic";

const GROUPS: GroupsPuzzleGroup[] = [
  {
    id: "easy",
    year: 1969,
    tier: "easy",
    eventIds: ["a", "b", "c", "d"],
  },
  {
    id: "medium",
    year: 1776,
    tier: "medium",
    eventIds: ["e", "f", "g", "h"],
  },
  {
    id: "hard",
    year: 1453,
    tier: "hard",
    eventIds: ["i", "j", "k", "l"],
  },
  {
    id: "very-hard",
    year: -44,
    tier: "very hard",
    eventIds: ["m", "n", "o", "p"],
  },
];

describe("evaluateGroupSelection", () => {
  it("returns solved with revealed year and tier for an exact match", () => {
    expect(evaluateGroupSelection(GROUPS, ["d", "c", "b", "a"])).toEqual({
      result: "solved",
      matchedGroupId: "easy",
      revealedYear: 1969,
      revealedTier: "easy",
    });
  });

  it("returns one_away when exactly three items belong to one group", () => {
    expect(evaluateGroupSelection(GROUPS, ["a", "b", "c", "e"])).toEqual({
      result: "one_away",
    });
  });

  it("returns miss when no group has an overlap of three or four", () => {
    expect(evaluateGroupSelection(GROUPS, ["a", "b", "e", "f"])).toEqual({
      result: "miss",
    });
  });
});

describe("groups completion helpers", () => {
  it("counts non-solved submissions as mistakes", () => {
    const submissions: GroupsSubmissionRecord[] = [
      { eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 1 },
      { eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 2 },
      { eventIds: ["a", "b", "e", "f"], result: "miss", timestamp: 3 },
    ];

    expect(countMistakes(submissions)).toBe(2);
  });

  it("detects puzzle completion when all group ids are solved", () => {
    expect(isGroupsPuzzleComplete(GROUPS, ["easy", "medium", "hard", "very-hard"])).toBe(true);
    expect(isGroupsPuzzleComplete(GROUPS, ["easy", "medium"])).toBe(false);
  });

  it("validates a completed play transcript against the hidden groups", () => {
    const submissions: GroupsSubmissionRecord[] = [
      { eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 1 },
      { eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 2 },
      { eventIds: ["e", "f", "g", "h"], result: "solved", timestamp: 3 },
      { eventIds: ["i", "j", "k", "l"], result: "solved", timestamp: 4 },
      { eventIds: ["m", "n", "o", "p"], result: "solved", timestamp: 5 },
    ];

    expect(
      validateCompletedGroupsPlay({
        groups: GROUPS,
        solvedGroupIds: ["easy", "medium", "hard", "very-hard"],
        submissions,
        mistakes: 1,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a completed play when the stored mistakes do not match the transcript", () => {
    const submissions: GroupsSubmissionRecord[] = [
      { eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 1 },
      { eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 2 },
      { eventIds: ["e", "f", "g", "h"], result: "solved", timestamp: 3 },
      { eventIds: ["i", "j", "k", "l"], result: "solved", timestamp: 4 },
      { eventIds: ["m", "n", "o", "p"], result: "solved", timestamp: 5 },
    ];

    expect(
      validateCompletedGroupsPlay({
        groups: GROUPS,
        solvedGroupIds: ["easy", "medium", "hard", "very-hard"],
        submissions,
        mistakes: 0,
      }),
    ).toEqual({
      ok: false,
      reason: "Stored mistakes do not match submission transcript.",
    });
  });

  it("rejects completed plays that claim solved groups not present in the transcript", () => {
    const submissions: GroupsSubmissionRecord[] = [
      { eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 1 },
      { eventIds: ["e", "f", "g", "h"], result: "solved", timestamp: 2 },
      { eventIds: ["i", "j", "k", "l"], result: "solved", timestamp: 3 },
      { eventIds: ["a", "b", "c", "e"], result: "one_away", timestamp: 4 },
    ];

    expect(
      validateCompletedGroupsPlay({
        groups: GROUPS,
        solvedGroupIds: ["easy", "medium", "hard", "very-hard"],
        submissions,
        mistakes: 1,
      }),
    ).toEqual({
      ok: false,
      reason: "Solved group ids include groups never solved in the transcript.",
    });
  });

  it("rejects completed plays that reuse the same solved group", () => {
    const submissions: GroupsSubmissionRecord[] = [
      { eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 1 },
      { eventIds: ["a", "b", "c", "d"], result: "solved", timestamp: 2 },
      { eventIds: ["e", "f", "g", "h"], result: "solved", timestamp: 3 },
      { eventIds: ["i", "j", "k", "l"], result: "solved", timestamp: 4 },
      { eventIds: ["m", "n", "o", "p"], result: "solved", timestamp: 5 },
    ];

    expect(
      validateCompletedGroupsPlay({
        groups: GROUPS,
        solvedGroupIds: ["easy", "medium", "hard", "very-hard"],
        submissions,
        mistakes: 0,
      }),
    ).toEqual({
      ok: false,
      reason: "Submission transcript solved the same group more than once.",
    });
  });
});
