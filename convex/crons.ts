import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Simple UTC midnight schedule - puzzles generate at 00:00 UTC daily
// With on-demand generation as fallback, this is just an optimization
crons.daily(
  "generate daily puzzle at UTC midnight",
  { hourUTC: 0, minuteUTC: 0 },
  internal.puzzles.generateDailyPuzzle,
  {},
);

crons.daily(
  "autonomous event pool replenishment",
  { hourUTC: 2, minuteUTC: 0 },
  internal.actions.eventGeneration.orchestrator.generateDailyBatch,
  { targetCount: 3 },
);

export default crons;
