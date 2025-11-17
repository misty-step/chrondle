import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export type GenerationStatus = "success" | "failed" | "skipped";

export interface DailyGenerationStats {
  totalYears: number;
  successfulYears: number;
  failedYears: number;
  eventsGenerated: number;
  totalCost: number;
  avgTokensPerYear: number;
}

export interface EventPoolHealth {
  totalEvents: number;
  unusedEvents: number;
  usedEvents: number;
  daysUntilDepletion: number;
  coverageByEra: {
    ancient: number;
    medieval: number;
    modern: number;
  };
}

export const logGenerationAttempt = internalMutation({
  args: {
    year: v.number(),
    era: v.string(),
    status: v.string(),
    attempt_count: v.number(),
    events_generated: v.number(),
    token_usage: v.object({
      input: v.number(),
      output: v.number(),
      total: v.number(),
    }),
    cost_usd: v.number(),
    error_message: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timestamp = args.timestamp ?? Date.now();

    const id = await ctx.db.insert("generation_logs", {
      ...args,
      timestamp,
    });

    return { id };
  },
});

export const getDailyGenerationStats = internalQuery({
  args: {
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DailyGenerationStats> => {
    const { start, end } = deriveDayRange(args.date);

    const logs = await ctx.db
      .query("generation_logs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", start).lt("timestamp", end))
      .collect();

    return summarizeGenerationLogs(logs);
  },
});

export const getFailedYears = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, args.limit ?? 20);

    const logs = await ctx.db
      .query("generation_logs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },
});

export const getEventPoolHealth = internalQuery({
  handler: async (ctx): Promise<EventPoolHealth> => {
    const events = await ctx.db.query("events").collect();
    return calculateEventPoolHealth(events);
  },
});

// Public for cost analysis scripts
export const getLast7DaysCosts = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = Math.max(1, Math.min(args.days ?? 7, 30));
    const buckets: Array<{
      date: string;
      totalCost: number;
      eventsGenerated: number;
      successRate: number;
    }> = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const { start, end, isoDate } = deriveDayRange(undefined, -offset);
      const logs = await ctx.db
        .query("generation_logs")
        .withIndex("by_timestamp", (q) => q.gte("timestamp", start).lt("timestamp", end))
        .collect();

      const summary = summarizeGenerationLogs(logs);
      buckets.push({
        date: isoDate,
        totalCost: summary.totalCost,
        eventsGenerated: summary.eventsGenerated,
        successRate: summary.totalYears === 0 ? 0 : summary.successfulYears / summary.totalYears,
      });
    }

    return buckets;
  },
});

export function summarizeGenerationLogs(
  logs: ReadonlyArray<Doc<"generation_logs">>,
): DailyGenerationStats {
  if (logs.length === 0) {
    return {
      totalYears: 0,
      successfulYears: 0,
      failedYears: 0,
      eventsGenerated: 0,
      totalCost: 0,
      avgTokensPerYear: 0,
    };
  }

  const successfulYears = logs.filter((log) => log.status === "success").length;
  const failedYears = logs.filter((log) => log.status === "failed").length;
  const eventsGenerated = logs.reduce((sum, log) => sum + log.events_generated, 0);
  const totalCost = logs.reduce((sum, log) => sum + log.cost_usd, 0);
  const totalTokens = logs.reduce((sum, log) => sum + log.token_usage.total, 0);

  return {
    totalYears: logs.length,
    successfulYears,
    failedYears,
    eventsGenerated,
    totalCost,
    avgTokensPerYear: totalTokens / logs.length,
  };
}

export function calculateEventPoolHealth(events: ReadonlyArray<Doc<"events">>): EventPoolHealth {
  const totalEvents = events.length;
  const unusedEvents = events.filter((event) => event.puzzleId === undefined);
  const usedEvents = totalEvents - unusedEvents.length;

  const coverage = {
    ancient: 0,
    medieval: 0,
    modern: 0,
  };

  for (const event of unusedEvents) {
    if (event.year < 500) {
      coverage.ancient += 1;
    } else if (event.year < 1500) {
      coverage.medieval += 1;
    } else {
      coverage.modern += 1;
    }
  }

  const daysUntilDepletion = unusedEvents.length > 0 ? Math.floor(unusedEvents.length / 6) : 0;

  return {
    totalEvents,
    unusedEvents: unusedEvents.length,
    usedEvents,
    daysUntilDepletion,
    coverageByEra: coverage,
  };
}

function deriveDayRange(dateInput?: string, offsetDays = 0) {
  const date = dateInput ? new Date(`${dateInput}T00:00:00.000Z`) : new Date();
  if (!dateInput && offsetDays !== 0) {
    date.setUTCDate(date.getUTCDate() + offsetDays);
  }
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date provided: ${dateInput}`);
  }

  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end, isoDate: date.toISOString().slice(0, 10) };
}
