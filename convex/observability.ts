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
import {
  getMetrics,
  calculatePoolHealth,
  type PoolHealthMode,
} from "./lib/observability/metricsService";
import type { Metrics, TimeRange, PoolHealthMetrics } from "./lib/observability/metricsCollector";

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
 *
 * @param mode - Optional filter: "classic" | "order" | "all" (default: "all")
 */
export const getPoolHealthQuery = query({
  args: {
    mode: v.optional(v.union(v.literal("classic"), v.literal("order"), v.literal("all"))),
  },
  handler: async (ctx, args): Promise<PoolHealthMetrics> => {
    const mode = (args.mode ?? "all") as PoolHealthMode;
    const events = await ctx.db.query("events").collect();
    return calculatePoolHealth(events, mode);
  },
});

/**
 * Query for pool health metrics across ALL modes at once.
 * Returns separate metrics for Classic, Order, and Both unused.
 * Useful for dashboard overview showing all modes simultaneously.
 */
export const getPoolHealthByModeQuery = query({
  handler: async (
    ctx,
  ): Promise<{
    classic: PoolHealthMetrics;
    order: PoolHealthMetrics;
    all: PoolHealthMetrics;
    totalEvents: number;
  }> => {
    const events = await ctx.db.query("events").collect();
    return {
      classic: calculatePoolHealth(events, "classic"),
      order: calculatePoolHealth(events, "order"),
      all: calculatePoolHealth(events, "all"),
      totalEvents: events.length,
    };
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

/**
 * Query for recent generation attempts.
 * Returns last N generation logs for debugging and monitoring.
 */
export const getRecentGenerationsQuery = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100)); // Cap at 100

    const logs = await ctx.db.query("generation_logs").order("desc").take(limit);

    return logs;
  },
});
