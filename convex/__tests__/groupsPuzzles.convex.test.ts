import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const apiRef = anyApi as any;
const groupsQueries = apiRef["groupsPuzzles/queries"];
const groupsMutations = apiRef["groupsPuzzles/mutations"];
const groupsPlayQueries = apiRef["groupsPlays/queries"];

const GROUPS_FIXTURE = {
  board: [
    { id: "a", text: "Moon landing", year: 1969, groupId: "g1" },
    { id: "b", text: "Woodstock", year: 1969, groupId: "g1" },
    { id: "c", text: "ARPANET message", year: 1969, groupId: "g1" },
    { id: "d", text: "Concorde test flight", year: 1969, groupId: "g1" },
    { id: "e", text: "Declaration of Independence", year: 1776, groupId: "g2" },
    { id: "f", text: "Battle of Long Island", year: 1776, groupId: "g2" },
    { id: "g", text: "Adam Smith publishes The Wealth of Nations", year: 1776, groupId: "g2" },
    { id: "h", text: "Washington crosses to New York command", year: 1776, groupId: "g2" },
    { id: "i", text: "Fall of Constantinople", year: 1453, groupId: "g3" },
    { id: "j", text: "End of Hundred Years' War", year: 1453, groupId: "g3" },
    { id: "k", text: "Printing of Gutenberg Bible completes", year: 1453, groupId: "g3" },
    { id: "l", text: "Mehmed II enters Constantinople", year: 1453, groupId: "g3" },
    { id: "m", text: "Assassination of Julius Caesar", year: -44, groupId: "g4" },
    { id: "n", text: "Octavian celebrates consulship", year: -44, groupId: "g4" },
    { id: "o", text: "Caesar named dictator for life", year: -44, groupId: "g4" },
    { id: "p", text: "Roman civil war resumes", year: -44, groupId: "g4" },
  ],
  groups: [
    { id: "g1", year: 1969, tier: "easy" as const, eventIds: ["a", "b", "c", "d"] },
    { id: "g2", year: 1776, tier: "medium" as const, eventIds: ["e", "f", "g", "h"] },
    { id: "g3", year: 1453, tier: "hard" as const, eventIds: ["i", "j", "k", "l"] },
    { id: "g4", year: -44, tier: "very hard" as const, eventIds: ["m", "n", "o", "p"] },
  ],
};

async function insertUserAndPuzzle(t: ReturnType<typeof convexTest>, date: string) {
  let userId!: Id<"users">;
  let puzzleId!: Id<"groupsPuzzles">;
  const clerkId = "groups-test-user";

  await t.run(async (ctx) => {
    userId = await ctx.db.insert("users", {
      clerkId,
      email: "groups@test.com",
      currentStreak: 0,
      longestStreak: 0,
      totalPlays: 0,
      perfectGames: 0,
      updatedAt: Date.now(),
    });

    puzzleId = await ctx.db.insert("groupsPuzzles", {
      puzzleNumber: 1,
      date,
      board: GROUPS_FIXTURE.board,
      groups: GROUPS_FIXTURE.groups,
      seed: "seed-1",
      updatedAt: Date.now(),
    });
  });

  return { clerkId, userId, puzzleId };
}

describe("groupsPuzzles", () => {
  it("returns today's public puzzle with grouping data for local play parity", async () => {
    const t = convexTest(schema, modules);
    const today = new Date().toISOString().slice(0, 10);

    await t.run(async (ctx) => {
      await ctx.db.insert("groupsPuzzles", {
        puzzleNumber: 1,
        date: today,
        board: GROUPS_FIXTURE.board,
        groups: GROUPS_FIXTURE.groups,
        seed: "seed-1",
        updatedAt: Date.now(),
      });
    });

    const puzzle = await t.query(groupsQueries.getDailyGroupsPuzzle, {});

    expect(puzzle).not.toBeNull();
    expect(puzzle?.groups).toEqual(GROUPS_FIXTURE.groups);
    expect(puzzle?.board[0]).toEqual({ id: "a", text: "Moon landing" });
  });

  it("requires authentication to submit a selection", async () => {
    const t = convexTest(schema, modules);
    const today = new Date().toISOString().slice(0, 10);
    const { puzzleId, userId } = await insertUserAndPuzzle(t, today);

    await expect(
      t.mutation(groupsMutations.submitGroupSelection, {
        puzzleId,
        userId,
        eventIds: ["a", "b", "c", "d"],
      }),
    ).rejects.toThrow("Authentication required");
  });

  it("returns archive puzzles without subscription gating", async () => {
    const t = convexTest(schema, modules);
    const pastDate = "2024-01-15";
    await insertUserAndPuzzle(t, pastDate);

    const puzzle = await t.query(groupsQueries.getGroupsPuzzleByNumber, { puzzleNumber: 1 });

    expect(puzzle).not.toBeNull();
    expect(puzzle?.groups).toEqual(GROUPS_FIXTURE.groups);
  });

  it("returns archive puzzles for authenticated users without requiring entitlement", async () => {
    const t = convexTest(schema, modules);
    const pastDate = "2024-01-15";
    const { clerkId } = await insertUserAndPuzzle(t, pastDate);

    const puzzle = await t
      .withIdentity({ subject: clerkId })
      .query(groupsQueries.getGroupsPuzzleByNumber, { puzzleNumber: 1 });

    expect(puzzle).not.toBeNull();
    expect(puzzle?.groups).toEqual(GROUPS_FIXTURE.groups);
    expect(puzzle?.board).toHaveLength(16);
  });

  it("allows archive submissions without archive access", async () => {
    const t = convexTest(schema, modules);
    const pastDate = "2024-01-15";
    const { clerkId, puzzleId, userId } = await insertUserAndPuzzle(t, pastDate);

    const result = await t
      .withIdentity({ subject: clerkId })
      .mutation(groupsMutations.submitGroupSelection, {
        puzzleId,
        userId,
        eventIds: ["a", "b", "c", "d"],
      });

    expect(result.outcome).toEqual({
      result: "solved",
      matchedGroupId: "g1",
      revealedYear: 1969,
      revealedTier: "easy",
    });
  });

  it("records a solved selection and reveals only the matched group", async () => {
    const t = convexTest(schema, modules);
    const today = new Date().toISOString().slice(0, 10);
    const { clerkId, puzzleId, userId } = await insertUserAndPuzzle(t, today);

    const result = await t
      .withIdentity({ subject: clerkId })
      .mutation(groupsMutations.submitGroupSelection, {
        puzzleId,
        userId,
        eventIds: ["d", "c", "b", "a"],
      });

    expect(result.outcome).toEqual({
      result: "solved",
      matchedGroupId: "g1",
      revealedYear: 1969,
      revealedTier: "easy",
    });
    expect(result.mistakes).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.revealedGroups).toEqual([
      { id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] },
    ]);

    const play = await t
      .withIdentity({ subject: clerkId })
      .query(groupsPlayQueries.getGroupsPlay, { userId, puzzleId });

    expect(play?.revealedGroups).toEqual([
      { id: "g1", year: 1969, tier: "easy", eventIds: ["a", "b", "c", "d"] },
    ]);
    expect(play?.hasWon).toBe(false);
  });

  it("reveals the full board after the fourth mistake", async () => {
    const t = convexTest(schema, modules);
    const today = new Date().toISOString().slice(0, 10);
    const { clerkId, puzzleId, userId } = await insertUserAndPuzzle(t, today);
    const authed = t.withIdentity({ subject: clerkId });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const interim = await authed.mutation(groupsMutations.submitGroupSelection, {
        puzzleId,
        userId,
        eventIds: ["a", "b", "e", "f"],
      });

      expect(interim.isComplete).toBe(false);
      expect(interim.mistakes).toBe(attempt + 1);
      expect(interim.revealedGroups).toEqual([]);
    }

    const finalAttempt = await authed.mutation(groupsMutations.submitGroupSelection, {
      puzzleId,
      userId,
      eventIds: ["a", "b", "e", "f"],
    });

    expect(finalAttempt.outcome).toEqual({ result: "miss" });
    expect(finalAttempt.mistakes).toBe(4);
    expect(finalAttempt.isComplete).toBe(true);
    expect(finalAttempt.hasWon).toBe(false);
    expect(finalAttempt.revealedGroups).toHaveLength(4);
  });

  it("returns only completed plays for archive progress summaries", async () => {
    const t = convexTest(schema, modules);
    const today = new Date().toISOString().slice(0, 10);
    const { userId, puzzleId } = await insertUserAndPuzzle(t, today);
    let secondPuzzleId!: Id<"groupsPuzzles">;

    await t.run(async (ctx) => {
      secondPuzzleId = await ctx.db.insert("groupsPuzzles", {
        puzzleNumber: 2,
        date: today,
        board: GROUPS_FIXTURE.board,
        groups: GROUPS_FIXTURE.groups,
        seed: "seed-2",
        updatedAt: Date.now(),
      });

      await ctx.db.insert("groupsPlays", {
        userId,
        puzzleId,
        solvedGroupIds: ["g1", "g2", "g3", "g4"],
        mistakes: 1,
        submissions: [],
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("groupsPlays", {
        userId,
        puzzleId: secondPuzzleId,
        solvedGroupIds: ["g1"],
        mistakes: 1,
        submissions: [],
        updatedAt: Date.now(),
      });
    });

    const completedPlays = await t.query(groupsPlayQueries.getUserCompletedGroupsPlays, {
      userId,
    });

    expect(completedPlays).toHaveLength(1);
    expect(completedPlays[0]?.puzzleId).toBe(puzzleId);
  });
});
