import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { buildGroupsBoard, type GroupsEventCandidate } from "./generation";
import {
  countMistakes,
  evaluateGroupSelection as evaluateGroupSelectionHelper,
  GROUPS_SELECTION_SIZE,
  isGroupsPuzzleComplete,
  MAX_GROUPS_MISTAKES,
} from "./logic";

type GenerationResult =
  | { status: "already_exists"; puzzle: unknown }
  | { status: "created"; puzzle: unknown };

type GroupsPlayDoc = {
  _id: Id<"groupsPlays">;
  solvedGroupIds: string[];
  mistakes: number;
  submissions: Array<{
    eventIds: string[];
    result: "solved" | "one_away" | "miss";
    timestamp: number;
  }>;
  completedAt?: number;
};

function normalizeEventIds(eventIds: string[]): string[] {
  return [...new Set(eventIds)].sort();
}

function serializeRevealedGroups(
  puzzle: Doc<"groupsPuzzles">,
  solvedGroupIds: string[],
  revealAll: boolean,
) {
  const solved = new Set(solvedGroupIds);

  return puzzle.groups
    .filter((group) => revealAll || solved.has(group.id))
    .map((group) => ({
      id: group.id,
      year: group.year,
      tier: group.tier,
      eventIds: group.eventIds,
    }));
}

function toGroupsPlayResponse(
  puzzle: Doc<"groupsPuzzles">,
  play: GroupsPlayDoc,
  latestOutcome?: ReturnType<typeof evaluateGroupSelectionHelper>,
) {
  const hasWon = isGroupsPuzzleComplete(puzzle.groups, play.solvedGroupIds);
  const revealAll = hasWon || play.mistakes >= MAX_GROUPS_MISTAKES;

  return {
    playId: play._id,
    outcome: latestOutcome ?? null,
    solvedGroupIds: play.solvedGroupIds,
    mistakes: play.mistakes,
    remainingMistakes: Math.max(0, MAX_GROUPS_MISTAKES - play.mistakes),
    isComplete: hasWon || play.mistakes >= MAX_GROUPS_MISTAKES,
    hasWon,
    submissions: play.submissions,
    revealedGroups: serializeRevealedGroups(puzzle, play.solvedGroupIds, revealAll),
  };
}

function hashDateSeed(date: string): number {
  let hash = 2166136261;
  for (let index = 0; index < date.length; index += 1) {
    hash ^= date.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getAllowedDateWindow(): string[] {
  const now = new Date();

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return [
    yesterday.toISOString().slice(0, 10),
    now.toISOString().slice(0, 10),
    tomorrow.toISOString().slice(0, 10),
  ];
}

function isDateInAllowedWindow(date: string): boolean {
  return getAllowedDateWindow().includes(date);
}

async function generateGroupsPuzzleForDate(
  ctx: MutationCtx,
  date?: string,
): Promise<GenerationResult> {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const existingPuzzle = await ctx.db
    .query("groupsPuzzles")
    .withIndex("by_date", (q) => q.eq("date", targetDate))
    .first();

  if (existingPuzzle) {
    return { status: "already_exists", puzzle: existingPuzzle };
  }

  const latestPuzzle = await ctx.db.query("groupsPuzzles").order("desc").first();
  const nextPuzzleNumber = (latestPuzzle?.puzzleNumber ?? 0) + 1;

  const availableEvents = (await ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("groupsPuzzleId"), undefined))
    .collect()) as GroupsEventCandidate[];

  const seedValue = hashDateSeed(targetDate);
  const builtBoard = buildGroupsBoard(availableEvents, seedValue);
  const puzzleId = await ctx.db.insert("groupsPuzzles", {
    puzzleNumber: nextPuzzleNumber,
    date: targetDate,
    board: builtBoard.board,
    groups: builtBoard.groups,
    seed: String(seedValue),
    updatedAt: Date.now(),
  });

  const usedEventIds = new Set(builtBoard.board.map((card) => card.id));
  for (const event of availableEvents) {
    const eventId = String(event._id);
    if (!usedEventIds.has(eventId)) {
      continue;
    }

    await ctx.db.patch(event._id as Id<"events">, {
      groupsPuzzleId: puzzleId,
      updatedAt: Date.now(),
    });
  }

  const puzzle = await ctx.db.get(puzzleId);
  return { status: "created", puzzle };
}

export const generateDailyGroupsPuzzle = internalMutation({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerationResult> =>
    generateGroupsPuzzleForDate(ctx, args.date),
});

export const generateTomorrowGroupsPuzzle = internalMutation({
  handler: async (ctx): Promise<GenerationResult> => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return generateGroupsPuzzleForDate(ctx, tomorrow.toISOString().slice(0, 10));
  },
});

export const ensureTodaysGroupsPuzzle = mutation({
  handler: async (ctx): Promise<GenerationResult> => generateGroupsPuzzleForDate(ctx),
});

export const ensureGroupsPuzzleForDate = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }): Promise<GenerationResult> => {
    if (!isDateInAllowedWindow(date)) {
      throw new Error("Date out of allowed window");
    }

    return generateGroupsPuzzleForDate(ctx, date);
  },
});

export const submitGroupSelection = mutation({
  args: {
    puzzleId: v.id("groupsPuzzles"),
    userId: v.id("users"),
    eventIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user = await ctx.db.get(args.userId);
    if (!user || user.clerkId !== identity.subject) {
      throw new Error("Forbidden");
    }

    const puzzle = await ctx.db.get(args.puzzleId);
    if (!puzzle) {
      throw new Error("Groups puzzle not found");
    }

    const existingPlay = (await ctx.db
      .query("groupsPlays")
      .withIndex("by_user_puzzle", (q) => q.eq("userId", args.userId).eq("puzzleId", args.puzzleId))
      .first()) as GroupsPlayDoc | null;

    if (
      existingPlay &&
      (existingPlay.completedAt ||
        isGroupsPuzzleComplete(puzzle.groups, existingPlay.solvedGroupIds) ||
        existingPlay.mistakes >= MAX_GROUPS_MISTAKES)
    ) {
      return toGroupsPlayResponse(puzzle, existingPlay);
    }

    const normalizedEventIds = normalizeEventIds(args.eventIds);
    if (normalizedEventIds.length !== GROUPS_SELECTION_SIZE) {
      throw new Error(
        `Groups selection must contain exactly ${GROUPS_SELECTION_SIZE} unique event ids.`,
      );
    }

    const boardEventIds = new Set(puzzle.board.map((card) => card.id));
    for (const eventId of normalizedEventIds) {
      if (!boardEventIds.has(eventId)) {
        throw new Error("Selection contains an event that is not on the board.");
      }
    }

    const solvedGroupIds = existingPlay?.solvedGroupIds ?? [];
    const solvedGroupSet = new Set(solvedGroupIds);
    const solvedEventIds = new Set(
      puzzle.groups
        .filter((group) => solvedGroupSet.has(group.id))
        .flatMap((group) => group.eventIds),
    );

    for (const eventId of normalizedEventIds) {
      if (solvedEventIds.has(eventId)) {
        throw new Error("Solved cards cannot be submitted again.");
      }
    }

    const remainingGroups = puzzle.groups.filter((group) => !solvedGroupSet.has(group.id));
    const outcome = evaluateGroupSelectionHelper(remainingGroups, normalizedEventIds);
    const submissions = [
      ...(existingPlay?.submissions ?? []),
      {
        eventIds: normalizedEventIds,
        result: outcome.result,
        timestamp: Date.now(),
      },
    ];
    const nextSolvedGroupIds =
      outcome.result === "solved" ? [...solvedGroupIds, outcome.matchedGroupId] : solvedGroupIds;
    const mistakes = countMistakes(submissions);
    const hasWon = isGroupsPuzzleComplete(puzzle.groups, nextSolvedGroupIds);
    const isComplete = hasWon || mistakes >= MAX_GROUPS_MISTAKES;

    const payload = {
      solvedGroupIds: nextSolvedGroupIds,
      mistakes,
      submissions,
      completedAt: isComplete ? Date.now() : existingPlay?.completedAt,
      updatedAt: Date.now(),
    };

    if (existingPlay) {
      await ctx.db.patch(existingPlay._id, payload);
      return toGroupsPlayResponse(
        puzzle,
        {
          ...existingPlay,
          ...payload,
        },
        outcome,
      );
    }

    const playId = await ctx.db.insert("groupsPlays", {
      userId: args.userId,
      puzzleId: args.puzzleId,
      ...payload,
    });

    return toGroupsPlayResponse(
      puzzle,
      {
        _id: playId,
        ...payload,
      },
      outcome,
    );
  },
});
