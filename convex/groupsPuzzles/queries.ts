import { v } from "convex/values";
import { query } from "../_generated/server";

function sanitizePuzzle(
  puzzle: {
    _id: unknown;
    date: string;
    puzzleNumber: number;
    board: Array<{ id: string; text: string }>;
    groups: Array<{ id: string; year: number; tier: string; eventIds: string[] }>;
    seed: string;
  } | null,
) {
  if (!puzzle) {
    return null;
  }

  return {
    _id: puzzle._id,
    date: puzzle.date,
    puzzleNumber: puzzle.puzzleNumber,
    board: puzzle.board.map((card) => ({
      id: card.id,
      text: card.text,
    })),
    groups: puzzle.groups.map((group) => ({
      id: group.id,
      year: group.year,
      tier: group.tier,
      eventIds: group.eventIds,
    })),
    seed: puzzle.seed,
  };
}

export const getGroupsPuzzleByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const puzzle = await ctx.db
      .query("groupsPuzzles")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    return sanitizePuzzle(puzzle);
  },
});

export const getDailyGroupsPuzzle = query({
  handler: async (ctx) => {
    const today = new Date().toISOString().slice(0, 10);

    const puzzle = await ctx.db
      .query("groupsPuzzles")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();

    return sanitizePuzzle(puzzle);
  },
});

export const getGroupsPuzzleByNumber = query({
  args: { puzzleNumber: v.number() },
  handler: async (ctx, { puzzleNumber }) => {
    const puzzle = await ctx.db
      .query("groupsPuzzles")
      .withIndex("by_number", (q) => q.eq("puzzleNumber", puzzleNumber))
      .first();

    return sanitizePuzzle(puzzle);
  },
});

export const getArchiveGroupsPuzzles = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    maxDate: v.optional(v.string()),
  },
  handler: async (ctx, { page, pageSize, maxDate }) => {
    const puzzles = maxDate
      ? await ctx.db
          .query("groupsPuzzles")
          .withIndex("by_date", (q) => q.lte("date", maxDate))
          .collect()
      : await ctx.db.query("groupsPuzzles").collect();

    puzzles.sort((a, b) => (b.puzzleNumber ?? 0) - (a.puzzleNumber ?? 0));

    const totalCount = puzzles.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      puzzles: puzzles.slice(startIndex, endIndex).map((puzzle) => sanitizePuzzle(puzzle)),
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      totalCount,
    };
  },
});
