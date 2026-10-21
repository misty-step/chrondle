import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../convex/schema";
import { modules } from "../../../convex/test.setup";
import { api } from "../../../convex/_generated/api";
import {
  addRangeToLocalState,
  readLocalGameState,
  reconcileLocalGameStates,
} from "../gameDataStore";

it("retries actual mutation arguments after acknowledgement loss without duplicate attempts or awards", async () => {
  const t = convexTest(schema, modules).withIdentity({ subject: "synthetic-preservation-user" });
  const { userId, puzzleIds } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: "synthetic-preservation-user",
      email: "synthetic@example.invalid",
      currentStreak: 0,
      longestStreak: 0,
      totalPlays: 0,
      perfectGames: 0,
      updatedAt: 1,
    });
    const puzzleIds = [];
    for (const puzzleNumber of [1, 2]) {
      puzzleIds.push(
        await ctx.db.insert("puzzles", {
          puzzleNumber,
          date: "2026-10-21",
          targetYear: 2000,
          events: ["Synthetic clue"],
          playCount: 0,
          avgGuesses: 0,
          updatedAt: 1,
        }),
      );
    }
    return { userId, puzzleIds };
  });
  const range = { start: 1990, end: 2010, hintsUsed: 1, score: 84, timestamp: 1000 } as const;
  for (const id of puzzleIds) addRangeToLocalState(id, range, true, true);
  let loseAcknowledgement = true;
  const merge = async (state: Parameters<Parameters<typeof reconcileLocalGameStates>[0]>[0]) => {
    const puzzleId = puzzleIds.find((id) => id === state.puzzleId);
    if (!puzzleId) throw new Error("Unknown synthetic puzzle");
    const result = await t.mutation(api.users.mergeAnonymousState, { ...state, puzzleId });
    if (loseAcknowledgement) throw new Error("acknowledgement lost after server commit");
    return result;
  };
  await reconcileLocalGameStates(merge);
  for (const id of puzzleIds) expect(readLocalGameState(id)?.ranges).toEqual([range]);
  loseAcknowledgement = false;
  await reconcileLocalGameStates(merge);
  for (const puzzleId of puzzleIds) {
    expect(readLocalGameState(puzzleId)).toBeNull();
    const play = await t.query(api.puzzles.getUserPlay, { userId, puzzleId });
    expect(play?.ranges).toEqual([range]);
    expect(play?.totalScore).toBe(84);
  }
  const user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.totalPlays).toBe(2);
  expect(user?.perfectGames).toBe(2);
  expect(user?.currentStreak).toBe(0);
});
