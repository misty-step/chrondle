import React from "react";
import { render, waitFor } from "@testing-library/react";
import { convexTest } from "convex-test";
import { getFunctionName } from "convex/server";
import { expect, it, vi } from "vitest";
import { z } from "zod";
import schema from "../../../convex/schema";
import { modules } from "../../../convex/test.setup";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { UserCreationProvider } from "../UserCreationProvider";
import { addRangeToLocalState, readLocalGameState } from "@/lib/gameDataStore";
import { rangeGuessSchema } from "@/lib/secureStorage";

let signedIn = false;
let user: Doc<"users"> | null = null;
let queryPlay: (args: unknown) => Promise<unknown>;
let mergeState: (args: unknown) => Promise<unknown>;
const createUser = vi.fn();
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isSignedIn: signedIn }) }));
vi.mock("convex/react", () => ({
  useQuery: () => user,
  useConvex: () => client,
}));
const client = { query: (_ref: unknown, args: unknown) => queryPlay(args) };
vi.mock("@/hooks/useMutationWithRetry", () => ({
  useMutationWithRetry: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).includes("mergeAnonymousState") ? mergeState : createUser,
}));

it.each([
  { newAccount: false, conflict: false },
  { newAccount: true, conflict: false },
  { newAccount: false, conflict: true },
])(
  "reconciles at sign-in (new=$newAccount, conflict=$conflict) without discarding unacknowledged attempts",
  async ({ newAccount, conflict }) => {
    const t = convexTest(schema, modules).withIdentity({ subject: "synthetic-existing-account" });
    const seed = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "synthetic-existing-account",
        email: "synthetic@example.invalid",
        currentStreak: 0,
        longestStreak: 0,
        totalPlays: 0,
        perfectGames: 0,
        updatedAt: 1,
      });
      const puzzleIds = [];
      for (const puzzleNumber of [1, 2])
        puzzleIds.push(
          await ctx.db.insert("puzzles", {
            puzzleNumber,
            date: "2026-10-21",
            targetYear: 2000,
            events: ["Synthetic"],
            playCount: 0,
            avgGuesses: 0,
            updatedAt: 1,
          }),
        );
      return { userId, puzzleIds, user: await ctx.db.get(userId) };
    });
    const serverRange = { start: 1900, end: 1910, hintsUsed: 0, score: 0, timestamp: 500 };
    if (conflict)
      await t.run((ctx) =>
        ctx.db.insert("plays", {
          userId: seed.userId,
          puzzleId: seed.puzzleIds[0],
          ranges: [serverRange],
          totalScore: 0,
          updatedAt: 500,
        }),
      );
    const localIds = ["a".repeat(32), "b".repeat(32)];
    const payload = z
      .object({
        puzzleId: z.string(),
        guesses: z.array(z.number()),
        ranges: z.array(rangeGuessSchema),
        isComplete: z.boolean(),
        hasWon: z.boolean(),
      })
      .strict();
    const findId = (value: string) => {
      const id = seed.puzzleIds[localIds.indexOf(value)];
      if (!id) throw new Error("Unknown fixture puzzle");
      return id;
    };
    mergeState = async (args) => {
      const parsed = payload.parse(args);
      return t.mutation(api.users.mergeAnonymousState, {
        ...parsed,
        puzzleId: findId(parsed.puzzleId),
      });
    };
    let failReadback = true;
    let readbacks = 0;
    queryPlay = async (args) => {
      readbacks += 1;
      const parsed = z.object({ puzzleId: z.string() }).passthrough().parse(args);
      if (failReadback && parsed.puzzleId === localIds[0]) throw new Error("readback unavailable");
      return t.query(api.puzzles.getUserPlay, {
        userId: seed.userId,
        puzzleId: findId(parsed.puzzleId),
      });
    };
    const range = { start: 1990, end: 2010, hintsUsed: 1, score: 84, timestamp: 1000 } as const;
    for (const id of localIds) addRangeToLocalState(id, range, true, true);
    createUser.mockResolvedValue(seed.user);
    signedIn = false;
    user = null;
    const view = render(<UserCreationProvider>fixture</UserCreationProvider>);
    signedIn = true;
    user = newAccount ? null : seed.user;
    view.rerender(<UserCreationProvider>fixture</UserCreationProvider>);
    await waitFor(() => expect(readLocalGameState(localIds[1])).toBeNull());
    expect(readLocalGameState(localIds[0])?.ranges).toEqual([range]);
    expect(createUser).toHaveBeenCalledTimes(newAccount ? 1 : 0);
    signedIn = false;
    user = null;
    view.rerender(<UserCreationProvider>fixture</UserCreationProvider>);
    failReadback = false;
    signedIn = true;
    user = seed.user;
    view.rerender(<UserCreationProvider>fixture</UserCreationProvider>);
    await waitFor(() => expect(readbacks).toBe(3));
    if (conflict) expect(readLocalGameState(localIds[0])?.ranges).toEqual([range]);
    else await waitFor(() => expect(readLocalGameState(localIds[0])).toBeNull());
    const stats = await t.run((ctx) => ctx.db.get(seed.userId));
    expect(stats?.totalPlays).toBe(conflict ? 1 : 2);
    for (const puzzleId of seed.puzzleIds)
      expect(
        (await t.query(api.puzzles.getUserPlay, { userId: seed.userId, puzzleId }))?.ranges,
      ).toEqual(conflict && puzzleId === seed.puzzleIds[0] ? [serverRange] : [range]);
  },
);
