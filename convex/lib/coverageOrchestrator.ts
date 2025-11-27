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
  const puzzles = await ctx.runQuery(api.puzzles.queries.getAllPuzzles, {});

  const selectionFrequency = puzzles.reduce(
    (acc: Map<number, number>, p) => acc.set(p.targetYear, (acc.get(p.targetYear) || 0) + 1),
    new Map<number, number>(),
  );

  const highDemandYears = Array.from(selectionFrequency.entries())
    .filter(([_, count]: [number, number]) => count > 1)
    .sort(([_, countA]: [number, number], [__, countB]: [number, number]) => countB - countA)
    .map(([year, _]: [number, number]) => year);

  const demandByEra = puzzles.reduce(
    (acc, p) => {
      acc[getEraBucket(p.targetYear)]++;
      return acc;
    },
    { ancient: 0, medieval: 0, modern: 0 } as Record<EraBucket, number>,
  );

  return { highDemandYears, demandByEra, selectionFrequency };
}

/**
 * Select years for event generation using demand-aware prioritization.
 *
 * Implements 80/20 allocation strategy:
 * - 80% to high-demand missing/insufficient years
 * - 20% to strategic coverage (ensuring era diversity)
 *
 * @param ctx - Action context for running queries
 * @param count - Number of years to select for this batch
 * @returns Coverage strategy with selected years and metadata
 */
export async function selectWork(ctx: ActionCtx, count: number): Promise<CoverageStrategy> {
  // Ensure count is at least 1
  const validCount = Math.max(1, count);

  // Run analyses in parallel
  const [gaps, demand] = await Promise.all([analyzeCoverageGaps(ctx), analyzePuzzleDemand(ctx)]);

  // Combine missing and insufficient years as candidates
  const allGapYears = [...new Set([...gaps.missingYears, ...gaps.insufficientYears])];

  // If no gap years, return empty strategy
  if (allGapYears.length === 0) {
    return {
      targetYears: [],
      priority: "low_quality",
      eraBalance: { ancient: 0, medieval: 0, modern: 0 },
    };
  }

  // Prioritize gap years by demand (high-demand gaps first)
  const highDemandGaps = allGapYears.filter((year) => demand.highDemandYears.includes(year));
  const otherGaps = allGapYears.filter((year) => !demand.highDemandYears.includes(year));

  // Calculate allocation (80/20 split)
  const highDemandCount = Math.min(Math.ceil(validCount * 0.8), highDemandGaps.length);
  const strategicCount = Math.min(validCount - highDemandCount, otherGaps.length);

  // Select high-demand years (prioritize by demand frequency)
  const selectedHighDemand = highDemandGaps
    .sort(
      (a, b) => (demand.selectionFrequency.get(b) || 0) - (demand.selectionFrequency.get(a) || 0),
    )
    .slice(0, highDemandCount);

  // Select strategic years (ensure at least 1 from each era if possible)
  const selectedStrategic = selectStrategicYears(otherGaps, strategicCount, gaps.coverageByEra);

  // Combine selections
  const targetYears = [...selectedHighDemand, ...selectedStrategic];

  // Calculate era balance
  const eraBalance = targetYears.reduce(
    (acc, year) => {
      acc[getEraBucket(year)]++;
      return acc;
    },
    { ancient: 0, medieval: 0, modern: 0 } as Record<EraBucket, number>,
  );

  // Determine primary priority
  const priority: YearCandidateSource = selectedHighDemand.length > 0 ? "missing" : "low_quality";

  return {
    targetYears,
    priority,
    eraBalance,
  };
}

/**
 * Select strategic years to ensure era diversity.
 *
 * Ensures at least 1 year from each era (ancient/medieval/modern) when possible,
 * then fills remaining slots with lowest-coverage eras.
 *
 * @param candidates - Available gap years
 * @param count - Number of strategic years to select
 * @param coverageByEra - Current coverage percentage by era
 * @returns Selected strategic years
 */
function selectStrategicYears(
  candidates: number[],
  count: number,
  coverageByEra: Record<EraBucket, number>,
): number[] {
  if (count === 0 || candidates.length === 0) return [];

  // Sort candidates by year for deterministic selection (lowest year first)
  const sortedCandidates = [...candidates].sort((a, b) => a - b);

  // Group candidates by era
  const candidatesByEra: Record<EraBucket, number[]> = {
    ancient: [],
    medieval: [],
    modern: [],
  };

  for (const year of sortedCandidates) {
    candidatesByEra[getEraBucket(year)].push(year);
  }

  const selected: number[] = [];
  const eras: EraBucket[] = ["ancient", "medieval", "modern"];

  // Phase 1: Try to select at least 1 from each era
  for (const era of eras) {
    if (selected.length >= count) break;
    if (candidatesByEra[era].length > 0) {
      // Pick first year from this era (deterministic)
      selected.push(candidatesByEra[era][0]);
      candidatesByEra[era].shift();
    }
  }

  // Phase 2: Fill remaining slots with lowest-coverage eras
  while (selected.length < count) {
    // Find era with lowest coverage that still has candidates
    const sortedEras = eras
      .filter((era) => candidatesByEra[era].length > 0)
      .sort((a, b) => coverageByEra[a] - coverageByEra[b]);

    if (sortedEras.length === 0) break; // No more candidates

    const lowestCoverageEra = sortedEras[0];
    // Pick first year from lowest-coverage era (deterministic)
    selected.push(candidatesByEra[lowestCoverageEra][0]);
    candidatesByEra[lowestCoverageEra].shift();
  }

  return selected;
}
