import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  type OrderEventCandidate,
  type SelectionConfig,
  selectEventsWithSpread,
} from "./generation";
import { arraysEqual, evaluateOrdering, isSolved, wouldSolve } from "../lib/orderValidation";
import type { PositionFeedback } from "../lib/orderValidation";

/**
 * Returns selection config with span constraints based on date hash.
 * Creates puzzle variety: some days tight ranges, some wide.
 *
 * Distribution:
 * - 15% focused (50-500 years) - Requires precise historical knowledge
 * - 30% moderate (200-1500 years) - Balanced challenge
 * - 55% wide (500-5000 years) - Current feel, maximum variety
 */
function getSelectionConfigForDate(date: string, excludeYears: number[]): SelectionConfig {
  const hash = hashDateSeed(date);
  const roll = hash % 100;

  if (roll < 15) {
    // Focused: tight range, needs more retries
    return { count: 6, minSpan: 50, maxSpan: 500, excludeYears, maxAttempts: 30 };
  }
  if (roll < 45) {
    // Moderate: balanced range
    return { count: 6, minSpan: 200, maxSpan: 1500, excludeYears, maxAttempts: 25 };
  }
  // Wide: original feel
  return { count: 6, minSpan: 500, maxSpan: 5000, excludeYears, maxAttempts: 20 };
}

const ORDER_SEED_SALT = process.env.ORDER_PUZZLE_SALT ?? "chrondle-order";

type StoredOrderEvent = {
  id: string;
  year: number;
  text: string;
};

type _GenerateArgs = {
  date?: string;
};

type GenerationResult =
  | { status: "already_exists"; puzzle: Doc<"orderPuzzles"> }
  | { status: "created"; puzzle: Doc<"orderPuzzles"> };

/**
 * Internal mutation triggered by cron to ensure the Order puzzle exists for a given date.
 */
export const generateDailyOrderPuzzle = internalMutation({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerationResult> => {
    return generateOrderPuzzleForDate(ctx, args?.date);
  },
});

/**
 * Public mutation so the frontend can guarantee Order puzzles exist on demand.
 */
export const ensureTodaysOrderPuzzle = mutation({
  handler: async (ctx): Promise<GenerationResult> => generateOrderPuzzleForDate(ctx),
});

import { withObservability } from "../lib/observability";
import type { Id } from "../_generated/dataModel";

/**
 * Order mode: Persists a completed Order play with attempts and score.
 */
export const submitOrderPlay = mutation({
  args: {
    puzzleId: v.id("orderPuzzles"),
    userId: v.id("users"),
    ordering: v.array(v.string()),
    attempts: v.array(
      v.object({
        ordering: v.array(v.string()),
        feedback: v.array(v.string()),
        pairsCorrect: v.number(),
        totalPairs: v.number(),
        timestamp: v.number(),
      }),
    ),
    score: v.object({
      attempts: v.number(),
    }),
  },
  handler: withObservability(
    async (
      ctx: MutationCtx,
      args: {
        puzzleId: Id<"orderPuzzles">;
        userId: Id<"users">;
        ordering: string[];
        attempts: Array<{
          ordering: string[];
          feedback: string[];
          pairsCorrect: number;
          totalPairs: number;
          timestamp: number;
        }>;
        score: {
          attempts: number;
        };
      },
    ) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Authentication required");
      }

      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (user.clerkId !== identity.subject) {
        throw new Error("Forbidden");
      }

      const puzzle = await ctx.db.get(args.puzzleId);
      if (!puzzle) {
        throw new Error("Order puzzle not found");
      }

      // Verify the score matches the number of attempts
      if (args.score.attempts !== args.attempts.length) {
        throw new Error("Score verification failed: attempts count mismatch");
      }

      // CRITICAL SECURITY: Three-layer server-side verification
      // Never trust client-provided attempts, feedback, or scores
      // Pattern: Same as Classic mode submitRange - server recomputes everything

      // Layer 1: Verify final ordering actually solves the puzzle
      if (!wouldSolve(args.ordering, puzzle.events)) {
        throw new Error("Validation failed: final ordering does not solve puzzle");
      }

      // Layer 2: Re-verify all attempts server-side (recompute feedback)
      for (let i = 0; i < args.attempts.length; i++) {
        const clientAttempt = args.attempts[i];
        const serverFeedback = evaluateOrdering(clientAttempt.ordering, puzzle.events);

        // Check feedback matches server recomputation
        if (!arraysEqual(clientAttempt.feedback, serverFeedback.feedback)) {
          throw new Error(`Validation failed: attempt ${i + 1} feedback mismatch`);
        }

        // Check pairs count matches server recomputation
        if (
          clientAttempt.pairsCorrect !== serverFeedback.pairsCorrect ||
          clientAttempt.totalPairs !== serverFeedback.totalPairs
        ) {
          throw new Error(`Validation failed: attempt ${i + 1} pair counts incorrect`);
        }
      }

      // Layer 3: Verify the final attempt is actually solved
      const finalAttempt = args.attempts[args.attempts.length - 1];
      if (!isSolved(finalAttempt as { feedback: PositionFeedback[] })) {
        throw new Error("Validation failed: final attempt is not solved");
      }

      const existingPlay = await ctx.db
        .query("orderPlays")
        .withIndex("by_user_puzzle", (q) =>
          q.eq("userId", args.userId).eq("puzzleId", args.puzzleId),
        )
        .first();

      const payload = {
        ordering: args.ordering,
        attempts: args.attempts,
        score: args.score,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (existingPlay) {
        await ctx.db.patch(existingPlay._id, payload);
      } else {
        await ctx.db.insert("orderPlays", {
          userId: args.userId,
          puzzleId: args.puzzleId,
          ...payload,
        });
      }

      return {
        status: "recorded" as const,
        score: args.score,
      };
    },
    { name: "submitOrderPlay" },
  ),
});

async function generateOrderPuzzleForDate(
  ctx: MutationCtx,
  dateOverride?: string,
): Promise<GenerationResult> {
  const targetDate = dateOverride ?? getUTCDateString();

  const existing = await ctx.db
    .query("orderPuzzles")
    .withIndex("by_date", (q) => q.eq("date", targetDate))
    .first();

  if (existing) {
    console.info(`[generateDailyOrderPuzzle] Order puzzle already exists for ${targetDate}`);
    return { status: "already_exists", puzzle: existing };
  }

  // Temporarily disable Classic year exclusion for testing
  const excludeYears: number[] = []; // await lookupClassicYear(ctx, targetDate);

  const seed = hashDateSeed(targetDate);
  const allEvents = await loadEventCandidates(ctx);
  const config = getSelectionConfigForDate(targetDate, excludeYears);

  const { selection, attempts } = selectEventsWithAttempts(allEvents, seed, config);

  const shuffledEvents = shuffleEvents(selection, seed);
  const storedEvents: StoredOrderEvent[] = shuffledEvents.map((event) => ({
    id: event._id,
    year: event.year,
    text: event.event,
  }));

  const latestPuzzle = await ctx.db.query("orderPuzzles").order("desc").first();
  const nextPuzzleNumber = (latestPuzzle?.puzzleNumber ?? 0) + 1;

  const puzzleId = await ctx.db.insert("orderPuzzles", {
    puzzleNumber: nextPuzzleNumber,
    date: targetDate,
    events: storedEvents,
    seed: String(seed),
    updatedAt: Date.now(),
  });

  // Mark selected events as used in Order mode
  for (const event of selection) {
    await ctx.db.patch(event._id as Id<"events">, {
      orderPuzzleId: puzzleId,
      updatedAt: Date.now(),
    });
  }

  const span = calculateSpan(selection);
  console.info(
    `[generateDailyOrderPuzzle] Created Order puzzle #${nextPuzzleNumber} for ${targetDate}`,
    {
      span,
      retryCount: attempts,
      excludedYears: excludeYears,
    },
  );

  const puzzle = await ctx.db.get(puzzleId);
  if (!puzzle) {
    throw new Error("Failed to load newly created Order puzzle.");
  }
  return { status: "created", puzzle };
}

async function _lookupClassicYear(ctx: MutationCtx, targetDate: string): Promise<number[]> {
  const classicPuzzle = await ctx.db
    .query("puzzles")
    .withIndex("by_date", (q) => q.eq("date", targetDate))
    .first();

  if (!classicPuzzle) {
    console.warn(
      `[generateDailyOrderPuzzle] No Classic puzzle found for ${targetDate}, skipping exclusion`,
    );
    return [];
  }

  return [classicPuzzle.targetYear];
}

async function loadEventCandidates(ctx: MutationCtx): Promise<OrderEventCandidate[]> {
  // Load events unused in Order mode (orderPuzzleId === undefined)
  const events = await ctx.db.query("events").collect();
  return events
    .filter((event) => event.orderPuzzleId === undefined)
    .map((event) => ({
      _id: event._id,
      year: event.year,
      event: event.event,
    }));
}

type SelectionOutcome = {
  selection: OrderEventCandidate[];
  attempts: number;
};

function selectEventsWithAttempts(
  events: OrderEventCandidate[],
  seed: number,
  config: SelectionConfig,
): SelectionOutcome {
  const maxAttempts = config.maxAttempts ?? 10;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const selection = selectEventsWithSpread(events, seed + attempt, {
        ...config,
        maxAttempts: 1,
      });
      return { selection, attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }

  // FALLBACK: If the specific config failed (e.g., "Focused" span 50-500), try a very lenient "Wide" config
  // This ensures we never fail to generate a daily puzzle just because of RNG + tight constraints
  console.warn(
    `[selectEventsWithAttempts] Failed to generate with config (span ${config.minSpan}-${config.maxSpan}), falling back to Wide config. Error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );

  const fallbackConfig: SelectionConfig = {
    ...config,
    minSpan: 500,
    maxSpan: 5000,
    maxAttempts: 20,
  };

  for (let attempt = 0; attempt < (fallbackConfig.maxAttempts ?? 10); attempt++) {
    try {
      const selection = selectEventsWithSpread(events, seed + maxAttempts + attempt, {
        ...fallbackConfig,
        maxAttempts: 1,
      });
      return { selection, attempts: maxAttempts + attempt };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to generate Order puzzle selection even after fallback: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function shuffleEvents(events: OrderEventCandidate[], seed: number): OrderEventCandidate[] {
  const prng = createPrng(seed);
  const array = [...events];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function hashDateSeed(date: string): number {
  const input = `${ORDER_SEED_SALT}:${date}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getUTCDateString(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateSpan(events: OrderEventCandidate[]): number {
  if (events.length < 2) return 0;
  const years = events.map((event) => event.year).sort((a, b) => a - b);
  return years[years.length - 1] - years[0];
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
