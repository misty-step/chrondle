import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { hasProperNoun, hasLeakage } from "./eventValidation";

const MIN_EVENTS_PER_YEAR = 6;
const YEAR_RANGE = { start: -776, end: 2008 };
const QUALITY_INSPECTION_LIMIT = 40;

type YearStats = {
  year: number;
  total: number;
  used: number;
  available: number;
};

export type YearCandidateSource = "missing" | "low_quality" | "fallback";

interface YearCandidate {
  year: number;
  severity: number;
  source: YearCandidateSource;
}

const ERA_BUCKETS = ["ancient", "medieval", "modern"] as const;
export type EraBucket = (typeof ERA_BUCKETS)[number];

export async function chooseWorkYears(
  ctx: ActionCtx,
  count: number,
): Promise<{ years: number[]; sourceBreakdown: YearCandidateSource[] }> {
  const requestedCount = Math.max(1, Math.min(count, 5));
  const stats = (await ctx.runQuery(api.events.getAllYearsWithStats, {})) as YearStats[];
  const statsMap = new Map(stats.map((stat) => [stat.year, stat]));

  const missingCandidates = computeMissingYearCandidates(statsMap);
  const lowQualityCandidates = await computeLowQualityCandidates(ctx, stats);
  const missingSet = new Set(missingCandidates.map((c) => c.year));
  const lowQualitySet = new Set(lowQualityCandidates.map((c) => c.year));

  const fallbackPool = createFallbackCandidates(stats, missingSet, lowQualitySet);

  const prioritized = prioritizeCandidates([
    ...missingCandidates,
    ...lowQualityCandidates,
    ...fallbackPool,
  ]);

  const years = pickBalancedYears(prioritized, requestedCount);

  return {
    years,
    sourceBreakdown: years.map((year) =>
      missingSet.has(year) ? "missing" : lowQualitySet.has(year) ? "low_quality" : "fallback",
    ),
  };
}

export const selectWorkYears = internalAction({
  args: {
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => chooseWorkYears(ctx, args.count ?? 3),
});

/**
 * Public wrapper for testing and admin scripts.
 * Calls the same internal logic as selectWorkYears.
 */
export const testSelectWorkYears = action({
  args: {
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => chooseWorkYears(ctx, args.count ?? 3),
});

function computeMissingYearCandidates(stats: Map<number, YearStats>): YearCandidate[] {
  const candidates: YearCandidate[] = [];
  for (let year = YEAR_RANGE.start; year <= YEAR_RANGE.end; year++) {
    if (!stats.has(year)) {
      candidates.push({ year, severity: MIN_EVENTS_PER_YEAR, source: "missing" });
    }
  }
  return candidates;
}

async function computeLowQualityCandidates(
  ctx: ActionCtx,
  stats: YearStats[],
): Promise<YearCandidate[]> {
  const interestingYears = stats
    .filter((stat) => stat.available < MIN_EVENTS_PER_YEAR * 2 || stat.used === 0)
    .sort((a, b) => a.available - b.available || a.used - b.used)
    .slice(0, QUALITY_INSPECTION_LIMIT);

  const candidates: YearCandidate[] = [];

  for (const stat of interestingYears) {
    const events = (await ctx.runQuery(api.events.getYearEvents, {
      year: stat.year,
    })) as ReadonlyArray<Doc<"events">>;
    if (!events.length) continue;

    const severity = computeQualitySeverity(stat, events);
    if (severity > 0) {
      candidates.push({ year: stat.year, severity, source: "low_quality" });
    }
  }

  return candidates;
}

function computeQualitySeverity(stat: YearStats, events: ReadonlyArray<Doc<"events">>): number {
  let score = 0;

  if (stat.available === 0) {
    score += 3;
  } else if (stat.available < MIN_EVENTS_PER_YEAR) {
    score += 2;
  }

  if (stat.used === 0) {
    score += 1;
  }

  const total = events.length;
  const lackingProperNoun = events.filter((event) => !hasProperNoun(event.event)).length;
  const leakageCount = events.filter((event) => hasLeakage(event.event)).length;

  if (lackingProperNoun / total > 0.4) {
    score += 2;
  }

  if (leakageCount / total > 0.15) {
    score += 1;
  }

  return score;
}

function createFallbackCandidates(
  stats: YearStats[],
  missing: Set<number>,
  lowQuality: Set<number>,
): YearCandidate[] {
  return stats
    .filter((stat) => !missing.has(stat.year) && !lowQuality.has(stat.year))
    .sort((a, b) => a.available - b.available)
    .slice(0, 50)
    .map((stat) => ({ year: stat.year, severity: 0, source: "fallback" }));
}

function prioritizeCandidates(candidates: YearCandidate[]): YearCandidate[] {
  const sourcePriority: Record<YearCandidateSource, number> = {
    missing: 0,
    low_quality: 1,
    fallback: 2,
  };

  return [...candidates].sort((a, b) => {
    const sourceDiff = sourcePriority[a.source] - sourcePriority[b.source];
    if (sourceDiff !== 0) return sourceDiff;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return Math.abs(a.year) - Math.abs(b.year);
  });
}

export function pickBalancedYears(candidates: YearCandidate[], count: number): number[] {
  const selected: number[] = [];
  const used = new Set<number>();

  const trySelect = (candidate?: YearCandidate) => {
    if (!candidate || used.has(candidate.year) || selected.length >= count) {
      return;
    }
    selected.push(candidate.year);
    used.add(candidate.year);
  };

  for (const bucket of ERA_BUCKETS) {
    if (selected.length >= count) break;
    const candidate = candidates.find(
      (item) => getEraBucket(item.year) === bucket && !used.has(item.year),
    );
    trySelect(candidate);
  }

  for (const candidate of candidates) {
    if (selected.length >= count) break;
    trySelect(candidate);
  }

  return selected;
}

export function getEraBucket(year: number): EraBucket {
  if (year <= 500) {
    return "ancient";
  }
  if (year < 1500) {
    return "medieval";
  }
  return "modern";
}
