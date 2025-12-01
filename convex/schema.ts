import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Pool of all historical events (one event per row for maximum reusability)
  events: defineTable({
    year: v.number(), // e.g., 1969
    event: v.string(), // "Neil Armstrong walks on the moon"
    classicPuzzleId: v.optional(v.id("puzzles")), // Links to Classic mode puzzle (null = unused in Classic)
    orderPuzzleId: v.optional(v.id("orderPuzzles")), // Links to Order mode puzzle (null = unused in Order)
    updatedAt: v.number(), // Manual timestamp (Convex provides _creationTime)
    // Metadata for future game modes (Timeline, Category, etc.)
    // Populated by Gemini 3 Generator. Optional for backward compatibility.
    metadata: v.optional(
      v.object({
        /** Difficulty rating (1-5). 1=Obvious, 5=Obscure. Used for difficulty scaling. */
        difficulty: v.optional(v.number()),
        /** Semantic categories (e.g., "war", "science"). Used for Category Mode. */
        category: v.optional(v.array(v.string())),
        /** Historical era. "ancient" (<500), "medieval" (500-1500), "modern" (>1500). */
        era: v.optional(v.string()),
        /** Fame level (1-5). How well-known the event is globally. */
        fame_level: v.optional(v.number()),
        /** Flexible tags for filtering (e.g., "space", "revolution"). */
        tags: v.optional(v.array(v.string())),
      }),
    ),
  })
    .index("by_year", ["year"])
    .index("by_classic_puzzle", ["classicPuzzleId"]) // Classic puzzle-to-event lookup
    .index("by_order_puzzle", ["orderPuzzleId"]) // Order puzzle-to-event lookup
    .index("by_year_classic_available", ["year", "classicPuzzleId"]) // Unused Classic events by year
    .index("by_year_order_available", ["year", "orderPuzzleId"]), // Unused Order events by year

  // Daily puzzles (starts empty, populated by cron job)
  puzzles: defineTable({
    puzzleNumber: v.number(), // Human-readable: #1, #2, etc.
    date: v.string(), // "2024-07-16"
    targetYear: v.number(), // Year to guess
    events: v.array(v.string()), // 6 events (denormalized for performance)
    playCount: v.number(), // Social proof: "1,234 players"
    avgGuesses: v.number(), // Difficulty: "Avg: 3.2 guesses"
    historicalContext: v.optional(v.string()), // AI-generated narrative (3000-4000 chars)
    historicalContextGeneratedAt: v.optional(v.number()), // Unix timestamp when context was generated
    updatedAt: v.number(), // For stats updates
  })
    .index("by_number", ["puzzleNumber"])
    .index("by_date", ["date"]),

  // Order mode daily puzzles
  orderPuzzles: defineTable({
    puzzleNumber: v.number(), // Sequential, mirrors Classic numbering scheme
    date: v.string(), // ISO date (YYYY-MM-DD)
    events: v.array(
      v.object({
        id: v.string(), // Stable event identifier (derived from events table)
        year: v.number(), // Used for scoring + reveal ordering
        text: v.string(), // Event description
      }),
    ),
    seed: v.string(), // Deterministic shuffle seed
    updatedAt: v.number(), // Mutation timestamp
  })
    .index("by_number", ["puzzleNumber"])
    .index("by_date", ["date"]),

  // Authenticated Order plays
  orderPlays: defineTable({
    userId: v.id("users"),
    puzzleId: v.id("orderPuzzles"),
    ordering: v.array(v.string()), // Player-submitted ordering (event ids)
    hints: v.array(v.string()), // Hint ids/types consumed
    completedAt: v.optional(v.number()), // Timestamp when ordering committed
    updatedAt: v.number(), // Last interaction timestamp
  })
    .index("by_user_puzzle", ["userId", "puzzleId"])
    .index("by_user", ["userId"]),

  // User puzzle attempts (authenticated users only)
  plays: defineTable({
    userId: v.id("users"),
    puzzleId: v.id("puzzles"),
    guesses: v.optional(v.array(v.number())), // Legacy single-year guesses
    ranges: v.optional(
      v.array(
        v.object({
          start: v.number(),
          end: v.number(),
          hintsUsed: v.number(),
          score: v.number(),
          timestamp: v.number(),
        }),
      ),
    ),
    totalScore: v.optional(v.number()),
    completedAt: v.optional(v.number()), // null = in progress, timestamp = done
    updatedAt: v.number(), // Last guess timestamp
  })
    .index("by_user_puzzle", ["userId", "puzzleId"])
    .index("by_user", ["userId"])
    .index("by_puzzle", ["puzzleId"]), // For stats calculation

  // User accounts
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    username: v.optional(v.string()), // For future leaderboards
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastCompletedDate: v.optional(v.string()), // ISO date (YYYY-MM-DD) of last puzzle completion
    totalPlays: v.number(),
    perfectGames: v.number(), // Guessed in 1 try
    updatedAt: v.number(), // For streak updates
  }).index("by_clerk", ["clerkId"]),

  // Event generation logs (for autonomous event pipeline monitoring)
  generation_logs: defineTable({
    year: v.number(),
    era: v.string(), // 'BCE' | 'CE'
    status: v.string(), // 'success' | 'failed' | 'skipped'
    attempt_count: v.number(),
    events_generated: v.number(),
    token_usage: v.object({
      input: v.number(),
      output: v.number(),
      reasoning: v.optional(v.number()),
      total: v.number(),
    }),
    cost_usd: v.number(),
    cache_hits: v.optional(v.number()),
    cache_misses: v.optional(v.number()),
    fallback_count: v.optional(v.number()),
    error_message: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_status", ["status", "timestamp"])
    .index("by_year", ["year"]),
});
