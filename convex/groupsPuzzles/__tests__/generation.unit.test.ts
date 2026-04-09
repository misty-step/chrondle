import { describe, expect, it } from "vitest";

import { buildGroupsBoard, type GroupsEventCandidate } from "../generation";

function makeEvents(year: number, count: number, difficulty = 3, fame = 3): GroupsEventCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    _id: `${year}-${index}` as never,
    year,
    event: `Event ${year}-${index}`,
    metadata: {
      difficulty,
      fame_level: fame,
    },
  }));
}

describe("buildGroupsBoard", () => {
  it("builds four groups of four events from distinct years", () => {
    const events = [
      ...makeEvents(-44, 5, 4, 4),
      ...makeEvents(1066, 5, 2, 4),
      ...makeEvents(1776, 5, 2, 5),
      ...makeEvents(1969, 5, 1, 5),
      ...makeEvents(1989, 5, 2, 5),
    ];

    const board = buildGroupsBoard(events, 1234);

    expect(board.groups).toHaveLength(4);
    expect(board.board).toHaveLength(16);
    expect(new Set(board.groups.map((group) => group.year)).size).toBe(4);
    expect(board.groups.every((group) => group.eventIds.length === 4)).toBe(true);
  });

  it("assigns each tier exactly once", () => {
    const events = [
      ...makeEvents(-44, 5, 5, 2),
      ...makeEvents(1066, 5, 4, 3),
      ...makeEvents(1776, 5, 2, 4),
      ...makeEvents(1969, 5, 1, 5),
    ];

    const board = buildGroupsBoard(events, 99);

    expect(board.groups.map((group) => group.tier).sort()).toEqual([
      "easy",
      "hard",
      "medium",
      "very hard",
    ]);
  });

  it("is deterministic for a given seed and event pool", () => {
    const events = [
      ...makeEvents(-44, 5, 5, 2),
      ...makeEvents(1066, 5, 4, 3),
      ...makeEvents(1776, 5, 2, 4),
      ...makeEvents(1969, 5, 1, 5),
      ...makeEvents(1989, 5, 2, 5),
    ];

    expect(buildGroupsBoard(events, 7)).toEqual(buildGroupsBoard(events, 7));
  });
});
