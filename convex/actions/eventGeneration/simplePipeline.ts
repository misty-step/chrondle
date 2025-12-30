"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { generateEvents, deriveEra, type GenerationResult } from "../../lib/eventGenerator";
import { logStageError, logStageSuccess } from "../../lib/logging";

/**
 * Simple Event Generation Pipeline
 *
 * Replaces the complex Generate → Critique → Revise pipeline with a single
 * self-validating LLM call. The LLM validates events before returning them,
 * with a fast deterministic safety net to catch obvious failures.
 *
 * Design Principles (Ousterhout):
 * - Simple interface: generateYearEvents(year) → events[]
 * - No loops, no retries, no score blending
 * - LLM does the quality work, code just orchestrates
 */

const MIN_REQUIRED_EVENTS = 6;
const MAX_EVENTS_TO_IMPORT = 10;

export interface SimpleGenerationResult {
  status: "success" | "failed";
  events: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
  };
  model: string;
  cacheHit: boolean;
}

/**
 * Generate events for a year using the simplified pipeline.
 * Single LLM call with self-validation, no loops.
 */
export const generateYearEventsSimple = internalAction({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args): Promise<SimpleGenerationResult> => {
    return executeSimpleGeneration(ctx, args.year);
  },
});

async function executeSimpleGeneration(
  ctx: ActionCtx,
  year: number,
): Promise<SimpleGenerationResult> {
  const era = deriveEra(year);

  let result: GenerationResult;
  try {
    // Single LLM call - the model self-validates before returning
    result = await generateEvents(year, era, 12);
  } catch (error) {
    logStageError("SimplePipeline", error, { year, era });
    return {
      status: "failed",
      events: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
      model: "unknown",
      cacheHit: false,
    };
  }

  logStageSuccess("SimplePipeline", `Generated ${result.events.length} events`, {
    year,
    era,
    eventCount: result.events.length,
    model: result.model,
    cacheHit: result.cacheHit,
    costUsd: result.costUsd,
  });

  // Check if we have enough valid events
  if (result.events.length < MIN_REQUIRED_EVENTS) {
    logStageError("SimplePipeline", new Error("Insufficient events after validation"), {
      year,
      generated: result.events.length,
      required: MIN_REQUIRED_EVENTS,
    });

    return {
      status: "failed",
      events: [],
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        costUsd: result.costUsd,
      },
      model: result.model,
      cacheHit: result.cacheHit,
    };
  }

  // Take up to MAX_EVENTS_TO_IMPORT, sorted by difficulty for variety
  const sortedEvents = [...result.events].sort((a, b) => a.difficulty - b.difficulty);
  const eventsToImport = sortedEvents.slice(0, MAX_EVENTS_TO_IMPORT).map((e) => e.text);

  // Import events to database
  await ctx.runMutation(internal.events.importYearEvents, {
    year,
    events: eventsToImport,
  });

  logStageSuccess("SimplePipeline", `Imported ${eventsToImport.length} events`, {
    year,
    imported: eventsToImport.length,
  });

  return {
    status: "success",
    events: eventsToImport,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      costUsd: result.costUsd,
    },
    model: result.model,
    cacheHit: result.cacheHit,
  };
}

/**
 * Generate events for multiple years in batch.
 * Simple parallel execution with no rate limiting complexity.
 */
export const generateBatchSimple = internalAction({
  args: {
    years: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.years.map(async (year) => {
        try {
          const result = await executeSimpleGeneration(ctx, year);
          return { year, result };
        } catch (error) {
          logStageError("SimplePipeline", error, { year });
          return {
            year,
            result: {
              status: "failed" as const,
              events: [],
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
              model: "unknown",
              cacheHit: false,
            },
          };
        }
      }),
    );

    const successes = results.filter((r) => r.result.status === "success");
    const failures = results.filter((r) => r.result.status === "failed");
    const totalCost = results.reduce((sum, r) => sum + r.result.usage.costUsd, 0);
    const totalEvents = results.reduce((sum, r) => sum + r.result.events.length, 0);

    logStageSuccess("SimplePipeline", "Batch completed", {
      years: args.years.length,
      successes: successes.length,
      failures: failures.length,
      totalEvents,
      totalCostUsd: totalCost,
    });

    return {
      years: args.years,
      successes: successes.length,
      failures: failures.length,
      failedYears: failures.map((f) => f.year),
      totalEvents,
      totalCostUsd: totalCost,
    };
  },
});
