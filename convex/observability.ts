/**
 * Convex API for observability metrics.
 *
 * Provides query interface for real-time metrics aggregation across:
 * - Pool health (event availability and coverage)
 * - Cost tracking (daily/weekly/monthly aggregates)
 * - Quality metrics (failure rates, trends)
 * - Generation latency (percentiles)
 *
 * Usage: Dashboard components call these queries via `useQuery(api.observability.getMetrics, ...)`
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getMetrics } from "./lib/observability/metricsService";
import type { Metrics, TimeRange } from "./lib/observability/metricsCollector";

/**
 * Query aggregated metrics for specified time range.
 *
 * @param timeRange - Time window: "1h" | "24h" | "7d" | "30d" | "all"
 * @returns Unified metrics across all observability dimensions
 */
export const getMetricsQuery = query({
  args: {
    timeRange: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Metrics> => {
    const timeRange = (args.timeRange ?? "24h") as TimeRange;
    return getMetrics(ctx, timeRange);
  },
});

/**
 * Query for pool health metrics only.
 * Optimized for lightweight dashboard cards that only need event pool status.
 */
export const getPoolHealthQuery = query({
  handler: async (ctx) => {
    const metrics = await getMetrics(ctx, "1h"); // Recent snapshot
    return metrics.poolHealth;
  },
});

/**
 * Query for cost metrics with custom time range.
 * Used by financial dashboards and cost analysis tools.
 */
export const getCostMetricsQuery = query({
  args: {
    timeRange: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timeRange = (args.timeRange ?? "7d") as TimeRange;
    const metrics = await getMetrics(ctx, timeRange);
    return metrics.cost;
  },
});

/**
 * Query for quality metrics with trend analysis.
 * Used by quality monitoring dashboards and alert systems.
 */
export const getQualityMetricsQuery = query({
  args: {
    timeRange: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timeRange = (args.timeRange ?? "7d") as TimeRange;
    const metrics = await getMetrics(ctx, timeRange);
    return metrics.quality;
  },
});
