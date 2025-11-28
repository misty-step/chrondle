/**
 * MetricsCollector implementation - aggregates and queries observability metrics.
 *
 * Deep module pattern: Simple recordGeneration/getMetrics interface hides:
 * - Time-series windowing and aggregation
 * - Percentile calculation for latencies
 * - Trend analysis for quality scores
 * - Complex multi-table queries
 *
 * Success criteria: Queries complete in <500ms
 */

import type { Doc } from "../../_generated/dataModel";
import type {
  CostTrackingMetrics,
  GenerationLatencyMetrics,
  GenerationResult,
  Metrics,
  PoolHealthMetrics,
  PuzzleCreationResult,
  QualityMetrics,
  TimeRange,
} from "./metricsCollector";

/**
 * Records a generation attempt to the generation_logs table.
 *
 * @param ctx - Convex mutation context
 * @param result - Generation result to record
 */
export async function recordGeneration(
  ctx: { db: { insert: (table: string, doc: Record<string, unknown>) => Promise<unknown> } },
  result: GenerationResult,
): Promise<void> {
  await ctx.db.insert("generation_logs", {
    year: result.year,
    era: result.era,
    status: result.status,
    attempt_count: 1, // Single attempt per call
    events_generated: result.eventsGenerated,
    token_usage: {
      input: result.tokenUsage.input,
      output: result.tokenUsage.output,
      reasoning: result.tokenUsage.reasoning,
      total: result.tokenUsage.total,
    },
    cost_usd: result.costUsd,
    cache_hits: result.cacheHits,
    cache_misses: result.cacheMisses,
    fallback_count: result.fallbackCount,
    error_message: result.errorMessage,
    timestamp: Date.now(),
  });
}

/**
 * Records puzzle creation for tracking consumption rate.
 * (Placeholder for future implementation - not critical for Phase 3.1)
 *
 * @param _ctx - Convex mutation context (unused)
 * @param _puzzle - Puzzle creation result (unused)
 */
export async function recordPuzzleCreation(
  _ctx: unknown,
  _puzzle: PuzzleCreationResult,
): Promise<void> {
  // TODO: Implement when puzzle consumption tracking is needed
  // For now, pool health metrics calculate depletion from unused events count
}

/**
 * Retrieves aggregated metrics for the specified time range.
 *
 * @param ctx - Convex query context (any query context with db access)
 * @param timeRange - Time window for metrics aggregation
 * @returns Unified metrics across all dimensions
 */
export async function getMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  timeRange: TimeRange,
): Promise<Metrics> {
  const now = Date.now();
  const startTime = calculateStartTime(now, timeRange);

  // Fetch generation logs for the time range
  const logs = await ctx.db
    .query("generation_logs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_timestamp", (q: any) => q.gte("timestamp", startTime))
    .collect();

  // Fetch all events for pool health
  const events = await ctx.db.query("events").collect();

  return {
    poolHealth: calculatePoolHealth(events),
    cost: calculateCostMetrics(logs, now),
    quality: calculateQualityMetrics(logs),
    latency: calculateLatencyMetrics(logs),
    timestamp: now,
  };
}

/**
 * Calculates the start timestamp for the given time range.
 */
function calculateStartTime(now: number, timeRange: TimeRange): number {
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  switch (timeRange) {
    case "1h":
      return now - HOUR_MS;
    case "24h":
      return now - DAY_MS;
    case "7d":
      return now - 7 * DAY_MS;
    case "30d":
      return now - 30 * DAY_MS;
    case "all":
      return 0;
    default:
      return now - DAY_MS; // Default to 24h
  }
}

/**
 * Calculates pool health metrics from events.
 */
function calculatePoolHealth(events: readonly Doc<"events">[]): PoolHealthMetrics {
  const unusedEvents = events.filter((e) => e.puzzleId === undefined);

  const coverageByEra = {
    ancient: 0,
    medieval: 0,
    modern: 0,
  };

  const yearsSet = new Set<number>();

  for (const event of unusedEvents) {
    yearsSet.add(event.year);

    if (event.year < 500) {
      coverageByEra.ancient += 1;
    } else if (event.year < 1500) {
      coverageByEra.medieval += 1;
    } else {
      coverageByEra.modern += 1;
    }
  }

  return {
    unusedEvents: unusedEvents.length,
    daysUntilDepletion: unusedEvents.length > 0 ? Math.floor(unusedEvents.length / 6) : 0,
    coverageByEra,
    yearsReady: yearsSet.size,
  };
}

/**
 * Calculates cost tracking metrics from generation logs.
 */
function calculateCostMetrics(
  logs: readonly Doc<"generation_logs">[],
  now: number,
): CostTrackingMetrics {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const todayStart = now - DAY_MS;
  const sevenDaysStart = now - 7 * DAY_MS;
  const thirtyDaysStart = now - 30 * DAY_MS;

  const todayLogs = logs.filter((log) => log.timestamp >= todayStart);
  const sevenDayLogs = logs.filter((log) => log.timestamp >= sevenDaysStart);
  const thirtyDayLogs = logs.filter((log) => log.timestamp >= thirtyDaysStart);

  const costToday = todayLogs.reduce((sum, log) => sum + log.cost_usd, 0);
  const cost7Day = sevenDayLogs.reduce((sum, log) => sum + log.cost_usd, 0);
  const cost30Day = thirtyDayLogs.reduce((sum, log) => sum + log.cost_usd, 0);

  const successfulEvents = logs
    .filter((log) => log.status === "success")
    .reduce((sum, log) => sum + log.events_generated, 0);

  const totalCost = logs.reduce((sum, log) => sum + log.cost_usd, 0);
  const costPerEvent = successfulEvents > 0 ? totalCost / successfulEvents : 0;

  return {
    costToday,
    cost7DayAvg: sevenDayLogs.length > 0 ? cost7Day / 7 : 0,
    cost30Day,
    costPerEvent,
  };
}

/**
 * Calculates quality metrics from generation logs.
 */
function calculateQualityMetrics(logs: readonly Doc<"generation_logs">[]): QualityMetrics {
  if (logs.length === 0) {
    return {
      avgQualityScore: 0,
      failureRate: 0,
      topFailureReasons: [],
      qualityTrend: [],
    };
  }

  // Calculate failure rate
  const failedCount = logs.filter((log) => log.status === "failed").length;
  const failureRate = failedCount / logs.length;

  // Extract top failure reasons
  const failureReasons = new Map<string, number>();
  for (const log of logs) {
    if (log.status === "failed" && log.error_message) {
      const reason = log.error_message.slice(0, 100); // Truncate long messages
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
    }
  }

  const topFailureReasons = Array.from(failureReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // Calculate quality trend (last 7 days)
  // For now, use success rate as proxy for quality score
  // TODO: Integrate actual quality scores when available from Critic stage
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const qualityTrend: number[] = [];

  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = now - (daysAgo + 1) * DAY_MS;
    const dayEnd = now - daysAgo * DAY_MS;
    const dayLogs = logs.filter((log) => log.timestamp >= dayStart && log.timestamp < dayEnd);

    if (dayLogs.length > 0) {
      const daySuccessRate =
        dayLogs.filter((log) => log.status === "success").length / dayLogs.length;
      qualityTrend.push(daySuccessRate);
    } else {
      qualityTrend.push(0);
    }
  }

  // Avg quality score (using success rate as proxy)
  const avgQualityScore =
    logs.length > 0 ? logs.filter((log) => log.status === "success").length / logs.length : 0;

  return {
    avgQualityScore,
    failureRate,
    topFailureReasons,
    qualityTrend,
  };
}

/**
 * Calculates generation latency metrics from generation logs.
 */
function calculateLatencyMetrics(
  logs: readonly Doc<"generation_logs">[],
): GenerationLatencyMetrics {
  // Note: generation_logs doesn't currently store duration_ms
  // This is a placeholder implementation that will work once orchestrator adds duration tracking
  // For now, return zero values as duration field doesn't exist yet

  // TODO: Add duration_ms field to generation_logs schema
  // TODO: Update orchestrator to record duration

  if (logs.length === 0) {
    return {
      p50: 0,
      p95: 0,
      p99: 0,
      avgDuration: 0,
    };
  }

  // Placeholder: Return zero until duration tracking is implemented
  return {
    p50: 0,
    p95: 0,
    p99: 0,
    avgDuration: 0,
  };
}

/**
 * Calculates percentile values from a sorted array of numbers.
 *
 * @param sortedValues - Array of numbers sorted in ascending order
 * @param percentile - Percentile to calculate (0-1 scale, e.g., 0.95 for p95)
 * @returns The percentile value
 */
export function calculatePercentile(sortedValues: readonly number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.ceil(sortedValues.length * percentile) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}
