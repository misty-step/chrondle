import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import type { Id } from "../_generated/dataModel";

// Type assertion for path-based API access (works at runtime, not type-checked)
const apiRef = anyApi as any;
const puzzlesMutations = apiRef["puzzles/mutations"];

/**
 * Streak Day-Boundary Tests (canonical local-day semantics)
 *
 * Chrondle's canonical "today" is the PLAYER'S local calendar day: game pages
 * resolve puzzles by the client's local date (src/lib/time/dailyDate.ts), so
 * the puzzle a player completes in the evening (after 00:00 UTC but before
 * local midnight) carries a date one day BEHIND the server's UTC date.
 *
 * Streak rules under these semantics:
 * - The puzzle's own date is the streak day marker (puzzle dates are the
 *   canonical day sequence).
 * - A puzzle counts as "daily" if its date is within one day of the server's
 *   UTC date — the timezone envelope (UTC-12..UTC+14). Anything older is
 *   archive and never touches the streak.
 * - Playing an older-dated puzzle after a newer one never rewinds or resets
 *   the streak.
 */
describe("streak day boundaries (local-day semantics)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function seed(
    t: ReturnType<typeof convexTest>,
    clerkId: string,
    user: { currentStreak: number; longestStreak: number; lastCompletedDate?: string },
    puzzleDate: string,
  ): Promise<{ puzzleId: Id<"puzzles">; userId: Id<"users"> }> {
    let puzzleId: Id<"puzzles">;
    let userId: Id<"users">;
    await t.run(async (ctx) => {
      userId = await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@test.com`,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        lastCompletedDate: user.lastCompletedDate,
        totalPlays: 0,
        perfectGames: 0,
        updatedAt: Date.now(),
      });
      puzzleId = await ctx.db.insert("puzzles", {
        puzzleNumber: 100,
        date: puzzleDate,
        targetYear: 1969,
        events: ["E1", "E2", "E3", "E4", "E5", "E6"],
        playCount: 0,
        avgGuesses: 0,
        updatedAt: Date.now(),
      });
    });
    return { puzzleId: puzzleId!, userId: userId! };
  }

  async function getUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
    return await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });
  }

  it("continues the streak when completing today's LOCAL puzzle after 00:00 UTC", async () => {
    // 2026-07-07T04:00Z = evening of 2026-07-06 in US timezones.
    // The player's local "today" (and thus the puzzle they play) is 07-06.
    vi.setSystemTime(new Date("2026-07-07T04:00:00.000Z"));

    const t = convexTest(schema, modules);
    const clerkId = "boundary_evening";
    const { puzzleId, userId } = await seed(
      t,
      clerkId,
      { currentStreak: 3, longestStreak: 5, lastCompletedDate: "2026-07-05" },
      "2026-07-06",
    );

    await t.withIdentity({ subject: clerkId }).mutation(puzzlesMutations.submitGuess, {
      puzzleId,
      guess: 1969,
    });

    const user = await getUser(t, userId);
    expect(user?.currentStreak).toBe(4);
    expect(user?.lastCompletedDate).toBe("2026-07-06");
  });

  it("continues the streak for players ahead of UTC (puzzle date = UTC tomorrow)", async () => {
    // 2026-07-06T22:00Z = morning of 2026-07-07 in UTC+14 (Kiritimati).
    vi.setSystemTime(new Date("2026-07-06T22:00:00.000Z"));

    const t = convexTest(schema, modules);
    const clerkId = "boundary_ahead";
    const { puzzleId, userId } = await seed(
      t,
      clerkId,
      { currentStreak: 1, longestStreak: 1, lastCompletedDate: "2026-07-06" },
      "2026-07-07",
    );

    await t.withIdentity({ subject: clerkId }).mutation(puzzlesMutations.submitGuess, {
      puzzleId,
      guess: 1969,
    });

    const user = await getUser(t, userId);
    expect(user?.currentStreak).toBe(2);
    expect(user?.lastCompletedDate).toBe("2026-07-07");
  });

  it("does NOT update the streak for an archive puzzle (2+ days old)", async () => {
    vi.setSystemTime(new Date("2026-07-07T04:00:00.000Z"));

    const t = convexTest(schema, modules);
    const clerkId = "boundary_archive";
    const { puzzleId, userId } = await seed(
      t,
      clerkId,
      { currentStreak: 3, longestStreak: 5, lastCompletedDate: "2026-07-04" },
      "2026-07-05", // two days behind UTC today: outside the timezone envelope
    );

    await t.withIdentity({ subject: clerkId }).mutation(puzzlesMutations.submitGuess, {
      puzzleId,
      guess: 1969,
    });

    const user = await getUser(t, userId);
    expect(user?.currentStreak).toBe(3);
    expect(user?.lastCompletedDate).toBe("2026-07-04");
  });

  it("never rewinds the streak when playing an older-dated puzzle after a newer one", async () => {
    // Player already completed 07-07 (UTC+14 morning), then plays 07-06's
    // puzzle. Within the timezone envelope, but must not reset the streak.
    vi.setSystemTime(new Date("2026-07-06T22:00:00.000Z"));

    const t = convexTest(schema, modules);
    const clerkId = "boundary_rewind";
    const { puzzleId, userId } = await seed(
      t,
      clerkId,
      { currentStreak: 7, longestStreak: 7, lastCompletedDate: "2026-07-07" },
      "2026-07-06",
    );

    await t.withIdentity({ subject: clerkId }).mutation(puzzlesMutations.submitGuess, {
      puzzleId,
      guess: 1969,
    });

    const user = await getUser(t, userId);
    expect(user?.currentStreak).toBe(7);
    expect(user?.lastCompletedDate).toBe("2026-07-07");
  });
});
