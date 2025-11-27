import type { EraBucket, YearCandidateSource } from "./workSelector";
import { getEraBucket } from "./workSelector";
import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

/**
 * Strategy for selecting years to generate events for in a batch.
 * Returned by selectWork() to guide Orchestrator.
 */
export interface CoverageStrategy {
  /** Years selected for generation in this batch */
  targetYears: number[];

  /** Primary priority driving year selection */
  priority: YearCandidateSource;

  /** Era distribution of selected years */
  eraBalance: Record<EraBucket, number>;
}

/**
 * Coverage gap analysis result
 */
export interface CoverageGaps {
  /** Years with 0 events */
  missingYears: number[];

  /** Years with <6 events */
  insufficientYears: number[];

  /** Coverage percentage by era (0-1) */
  coverageByEra: Record<EraBucket, number>;
}

/**
 * Puzzle demand analysis result
 */
export interface PuzzleDemand {
  /** Years used more than once in puzzles (sorted by frequency descending) */
  highDemandYears: number[];

  /** Total puzzle count by era */
  demandByEra: Record<EraBucket, number>;

  /** Map of year → number of puzzles using that year */
  selectionFrequency: Map<number, number>;
}

// Year range for puzzle generation
const YEAR_RANGE = { start: -776, end: 2008 };
const MIN_EVENTS_PER_YEAR = 6;

// Era boundaries (matching workSelector)
const ERA_TOTALS: Record<EraBucket, number> = {
  ancient: 500 - -776 + 1, // -776 to 500 = 1,277 years
  medieval: 1499 - 501 + 1, // 501 to 1499 = 999 years
  modern: 2008 - 1500 + 1, // 1500 to 2008 = 509 years
};

/**
 * Analyze coverage gaps across the year range.
 *
 * Identifies missing years, years with insufficient events, and calculates
 * coverage percentage by era to guide strategic work selection.
 *
 * @param ctx - Action context for running queries
 * @returns Coverage gap analysis
 */
export async function analyzeCoverageGaps(ctx: ActionCtx): Promise<CoverageGaps> {
  // Query all years with event counts
  const yearStats = (await ctx.runQuery(api.events.getAllYearsWithStats, {})) as Array<{
    year: number;
    total: number;
    used: number;
    available: number;
  }>;

  // Identify missing years (0 events)
  const yearsWithEvents = new Set(yearStats.map((stat) => stat.year));
  const missingYears = Array.from(
    { length: YEAR_RANGE.end - YEAR_RANGE.start + 1 },
    (_, i) => YEAR_RANGE.start + i,
  ).filter((year) => !yearsWithEvents.has(year));

  // Identify years with insufficient events (<6 total)
  const insufficientYears = yearStats
    .filter((stat) => stat.total < MIN_EVENTS_PER_YEAR)
    .map((stat) => stat.year);

  // Calculate coverage by era
  const eraCounts = yearStats.reduce(
    (acc, stat) => {
      acc[getEraBucket(stat.year)]++;
      return acc;
    },
    { ancient: 0, medieval: 0, modern: 0 } as Record<EraBucket, number>,
  );

  const coverageByEra = Object.fromEntries(
    Object.entries(eraCounts).map(([era, count]) => [era, count / ERA_TOTALS[era as EraBucket]]),
  ) as Record<EraBucket, number>;

  return {
    missingYears,
    insufficientYears,
    coverageByEra,
  };
}

/**
 * Analyze puzzle demand patterns to identify high-value years.
 *
 * Queries historical puzzle usage and identifies which years are most
 * frequently selected, broken down by era, to guide strategic work selection.
 *
 * @param ctx - Action context for running queries
 * @returns Puzzle demand analysis
 */
export async function analyzePuzzleDemand(ctx: ActionCtx): Promise<PuzzleDemand> {
  const puzzles = await ctx.runQuery(api.puzzles.getAllPuzzles, {});

  const selectionFrequency = puzzles.reduce(
    (acc, p) => acc.set(p.targetYear, (acc.get(p.targetYear) || 0) + 1),
    new Map<number, number>(),
  );

  const highDemandYears = Array.from(selectionFrequency.entries())
    .filter(([_, count]) => count > 1)
    .sort(([_, countA], [__, countB]) => countB - countA)
    .map(([year, _]) => year);

  const demandByEra = puzzles.reduce(
    (acc, p) => {
      acc[getEraBucket(p.targetYear)]++;
      return acc;
    },
    { ancient: 0, medieval: 0, modern: 0 } as Record<EraBucket, number>,
  );

  return { highDemandYears, demandByEra, selectionFrequency };
}
