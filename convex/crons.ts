import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily puzzle generation strategy:
 *
 * 1. At 00:00 UTC: Generate today's puzzles (for UTC and behind-UTC timezones)
 * 2. At 00:00 UTC: Pre-generate tomorrow's puzzles (for UTC+14 and ahead-UTC timezones)
 *
 * This ensures users in any timezone see their local day's puzzle at midnight.
 * Users up to UTC+14 are ahead by ~14 hours, so pre-generating tomorrow ensures
 * their local "today" puzzle exists when they cross local midnight.
 */

// Generate today's Classic puzzle (UTC)
crons.daily(
  "generate daily puzzle at UTC midnight",
  { hourUTC: 0, minuteUTC: 0 },
  internal.puzzles.generateDailyPuzzle,
  {},
);

// Pre-generate tomorrow's Classic puzzle (for ahead-UTC timezones)
crons.daily(
  "pre-generate tomorrow Classic puzzle",
  { hourUTC: 0, minuteUTC: 1 },
  internal.puzzles.generateTomorrowPuzzle,
  {},
);

crons.daily(
  "autonomous event pool replenishment",
  { hourUTC: 2, minuteUTC: 0 },
  internal.actions.eventGeneration.orchestrator.generateDailyBatch,
  { targetCount: 10 },
);

// Generate today's Order puzzle (UTC)
crons.daily(
  "generate daily Order puzzle at UTC midnight",
  { hourUTC: 0, minuteUTC: 0 },
  internal.orderPuzzles.generateDailyOrderPuzzle,
  {},
);

// Pre-generate tomorrow's Order puzzle (for ahead-UTC timezones)
crons.daily(
  "pre-generate tomorrow Order puzzle",
  { hourUTC: 0, minuteUTC: 1 },
  internal.orderPuzzles.generateTomorrowOrderPuzzle,
  {},
);

export default crons;
