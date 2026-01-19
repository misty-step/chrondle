"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { TokenUsage } from "../../lib/gemini3Client";
import { generateCandidatesForYear } from "./generator";
import { critiqueCandidatesForYear } from "./critic";
import type { CritiqueResult } from "./schemas";
import { reviseCandidatesForYear } from "./reviser";
import type { CandidateEvent, Era } from "./schemas";
import { selectWork } from "../../lib/coverageOrchestrator";
import { logStageError, logStageSuccess } from "../../lib/logging";
import { runAlertChecks } from "../../lib/alerts";
import { RateLimiter } from "../../lib/rateLimiter";
import { computeQualityScores, type QualityScores } from "../../lib/qualityScores";
import { withLangfuseTrace, type TraceWrapper } from "../../lib/langfuseTracing";

const MAX_TOTAL_ATTEMPTS = 4;
const MAX_CRITIC_CYCLES = 2;
const MIN_REQUIRED_EVENTS = 6;
const MAX_SELECTED_EVENTS = 10;
const MAX_TARGET_COUNT = 50;
const MIN_TARGET_COUNT = 1;

// Rate limiter for batch processing: 10 req/sec sustained, 20 burst capacity
// Prevents overwhelming OpenRouter API (60 req/min limit)
const rateLimiter = new RateLimiter({ tokensPerSecond: 10, burstCapacity: 20 });

export const generateYearEvents = internalAction({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => executeYearGeneration(ctx, args.year),
});

/**
 * Public wrapper for testing and admin scripts.
 * Calls the same internal logic as generateYearEvents.
 */
export const testGenerateYearEvents = action({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => executeYearGeneration(ctx, args.year),
});

export const generateDailyBatch = internalAction({
  args: {
    targetCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const targetCount = clampTargetCount(args.targetCount ?? 10);
    const strategy = await selectWork(ctx, targetCount);
    const startTime = Date.now();

    // Log strategy used
    logStageSuccess("Orchestrator", "Coverage strategy selected", {
      yearsSelected: strategy.targetYears.length,
      selectedYears: strategy.targetYears,
      priority: strategy.priority,
      eraBalance: strategy.eraBalance,
    });

    // Process years in parallel with rate limiting
    const results = await Promise.all(
      strategy.targetYears.map(async (year) => {
        try {
          // Wrap each generation in rate limiter to respect API limits
          const result = await rateLimiter.execute(async () => executeYearGeneration(ctx, year));
          return { year, result };
        } catch (error) {
          logStageError("Orchestrator", error, { year });
          return {
            year,
            result: {
              status: "failed" as const,
              reason: "insufficient_quality" as const,
              metadata: {
                attempts: 0,
                criticCycles: 0,
                revisions: 0,
                deterministicFailures: 0,
              },
              usage: createUsageSummary(),
            },
          };
        }
      }),
    );

    const duration = Date.now() - startTime;

    await runAlertChecks(ctx);

    const successes = results.filter((entry) => entry.result.status === "success");
    const failures = results.filter((entry) => entry.result.status === "failed");
    const totalCost = results.reduce((sum, entry) => sum + entry.result.usage.total.costUsd, 0);

    logStageSuccess("Orchestrator", "Batch completed", {
      attemptedYears: strategy.targetYears.length,
      successCount: successes.length,
      failureCount: failures.length,
      failedYears: failures.map((f) => f.year),
      totalCostUsd: totalCost,
      durationMs: duration,
      avgTimePerYear: Math.round(duration / strategy.targetYears.length),
    });

    return {
      attemptedYears: results.map((entry) => entry.year),
      successes: successes.length,
      failures: failures.length,
      totalCostUsd: totalCost,
      durationMs: duration,
    };
  },
});

export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
  cacheHits: number;
  cacheMisses: number;
  fallbacks: number;
}

export interface UsageSummary {
  generator: TokenUsageTotals;
  critic: TokenUsageTotals;
  reviser: TokenUsageTotals;
  total: TokenUsageTotals;
}

export interface PipelineMetadata {
  attempts: number;
  criticCycles: number;
  revisions: number;
  deterministicFailures: number;
}

export type FailureReason = "insufficient_quality";

export type YearGenerationResult =
  | {
      status: "success";
      events: CandidateEvent[];
      metadata: PipelineMetadata & {
        selectedCount: number;
      };
      usage: UsageSummary;
      qualityScores: QualityScores;
    }
  | {
      status: "failed";
      reason: FailureReason;
      metadata: PipelineMetadata;
      usage: UsageSummary;
      qualityScores?: QualityScores;
    };

interface PipelineDeps {
  generator: typeof generateCandidatesForYear;
  critic: typeof critiqueCandidatesForYear;
  reviser: typeof reviseCandidatesForYear;
}

const defaultDeps: PipelineDeps = {
  generator: generateCandidatesForYear,
  critic: critiqueCandidatesForYear,
  reviser: reviseCandidatesForYear,
};

export async function runGenerationPipeline(
  year: number,
  deps: PipelineDeps = defaultDeps,
): Promise<YearGenerationResult> {
  const era = deriveEra(year);

  return withLangfuseTrace(
    {
      name: "year-event-generation",
      input: { year, era },
      tags: ["chrondle", "event-generation"],
      metadata: { year, era },
    },
    async (traceWrapper) => {
      return runPipelineWithTracing(year, era, deps, traceWrapper);
    },
  );
}

/**
 * Core pipeline logic with Langfuse tracing instrumentation.
 */
async function runPipelineWithTracing(
  year: number,
  era: Era,
  deps: PipelineDeps,
  traceWrapper: TraceWrapper,
): Promise<YearGenerationResult> {
  const usage = createUsageSummary();
  let attempts = 0;
  let totalCycles = 0;
  let totalRevisions = 0;
  let totalDeterministicFailures = 0;
  // Track last critique for quality score computation on failure
  let lastCritiqueResults: CritiqueResult[] = [];

  while (attempts < MAX_TOTAL_ATTEMPTS) {
    attempts += 1;

    // Generator span
    const generatorSpan = traceWrapper.createSpan({
      name: "generator",
      input: { year, era, attempt: attempts },
    });

    const generation = await deps.generator({ year, era });
    recordUsage(usage.generator, usage.total, generation.llm.usage, generation.llm.costUsd, {
      cacheHit: generation.llm.cacheHit,
      fallbackFrom: generation.llm.fallbackFrom,
    });

    // Record generation in span
    generatorSpan.createGeneration({
      name: "generator-llm",
      model: generation.llm.model,
      usage: {
        inputTokens: generation.llm.usage.inputTokens,
        outputTokens: generation.llm.usage.outputTokens,
        totalTokens: generation.llm.usage.totalTokens,
      },
      metadata: {
        cacheHit: generation.llm.cacheHit,
        fallbackFrom: generation.llm.fallbackFrom,
        costUsd: generation.llm.costUsd,
      },
    });
    generatorSpan.endSpan({ candidateCount: generation.candidates.length });

    let candidates = generation.candidates;
    let cycles = 0;

    while (cycles < MAX_CRITIC_CYCLES) {
      cycles += 1;
      totalCycles += 1;

      // Critic span
      const criticSpan = traceWrapper.createSpan({
        name: "critic",
        input: { year, era, cycle: cycles, candidateCount: candidates.length },
      });

      const critique = await deps.critic({ year, era, candidates });
      recordUsage(usage.critic, usage.total, critique.llm.usage, critique.llm.costUsd, {
        cacheHit: critique.llm.cacheHit,
        fallbackFrom: critique.llm.fallbackFrom,
      });
      totalDeterministicFailures += critique.deterministicFailures;
      lastCritiqueResults = critique.results;

      // Record critic generation
      criticSpan.createGeneration({
        name: "critic-llm",
        model: critique.llm.model,
        usage: {
          inputTokens: critique.llm.usage.inputTokens,
          outputTokens: critique.llm.usage.outputTokens,
          totalTokens: critique.llm.usage.totalTokens,
        },
        metadata: {
          cacheHit: critique.llm.cacheHit,
          fallbackFrom: critique.llm.fallbackFrom,
          costUsd: critique.llm.costUsd,
          deterministicFailures: critique.deterministicFailures,
        },
      });

      const passingResults = critique.results.filter((result) => result.passed);
      criticSpan.endSpan({
        passCount: passingResults.length,
        failCount: critique.results.length - passingResults.length,
      });

      if (passingResults.length >= MIN_REQUIRED_EVENTS) {
        const selected = selectTopEvents(critique.results);
        if (selected.length >= MIN_REQUIRED_EVENTS) {
          // Compute quality scores from final critique
          const qualityScores = computeQualityScores({
            critiques: critique.results,
            selected,
          });

          // End trace with success
          traceWrapper.endTrace({
            status: "success",
            selectedCount: selected.length,
            qualityScores: {
              overall: qualityScores.overall,
              passCount: qualityScores.passCount,
            },
            totalCostUsd: usage.total.costUsd,
            cacheHits: usage.total.cacheHits,
            fallbacks: usage.total.fallbacks,
          });

          return {
            status: "success",
            events: selected,
            metadata: {
              attempts,
              criticCycles: totalCycles,
              revisions: totalRevisions,
              deterministicFailures: totalDeterministicFailures,
              selectedCount: selected.length,
            },
            usage,
            qualityScores,
          };
        }
      }

      const failingResults = critique.results.filter((result) => !result.passed);
      if (!failingResults.length || cycles >= MAX_CRITIC_CYCLES) {
        break;
      }

      // Reviser span
      const reviserSpan = traceWrapper.createSpan({
        name: "reviser",
        input: { year, era, failingCount: failingResults.length },
      });

      const revision = await deps.reviser({ failing: failingResults, year, era });
      recordUsage(usage.reviser, usage.total, revision.llm.usage, revision.llm.costUsd, {
        cacheHit: revision.llm.cacheHit,
        fallbackFrom: revision.llm.fallbackFrom,
      });
      totalRevisions += 1;

      // Record reviser generation
      reviserSpan.createGeneration({
        name: "reviser-llm",
        model: revision.llm.model,
        usage: {
          inputTokens: revision.llm.usage.inputTokens,
          outputTokens: revision.llm.usage.outputTokens,
          totalTokens: revision.llm.usage.totalTokens,
        },
        metadata: {
          cacheHit: revision.llm.cacheHit,
          fallbackFrom: revision.llm.fallbackFrom,
          costUsd: revision.llm.costUsd,
        },
      });
      reviserSpan.endSpan({ rewriteCount: revision.rewrites.length });

      candidates = rebuildCandidateSet(critique.results, revision.rewrites);
    }
  }

  // Compute quality scores from last critique (if available) for failed runs
  const qualityScores =
    lastCritiqueResults.length > 0
      ? computeQualityScores({ critiques: lastCritiqueResults, selected: [] })
      : undefined;

  // End trace with failure
  traceWrapper.endTrace({
    status: "failed",
    reason: "insufficient_quality",
    qualityScores: qualityScores
      ? { overall: qualityScores.overall, passCount: qualityScores.passCount }
      : undefined,
    totalCostUsd: usage.total.costUsd,
    cacheHits: usage.total.cacheHits,
    fallbacks: usage.total.fallbacks,
  });

  return {
    status: "failed",
    reason: "insufficient_quality",
    metadata: {
      attempts,
      criticCycles: totalCycles,
      revisions: totalRevisions,
      deterministicFailures: totalDeterministicFailures,
    },
    usage,
    qualityScores,
  };
}

function deriveEra(year: number): Era {
  return year <= 0 ? "BCE" : "CE";
}

function rebuildCandidateSet(
  results: CritiqueResult[],
  rewrites: CandidateEvent[],
): CandidateEvent[] {
  let rewriteIndex = 0;
  return results.map((result) => {
    if (result.passed) {
      return result.event;
    }
    const rewrite = rewrites[rewriteIndex];
    rewriteIndex += 1;
    return rewrite ?? result.event;
  });
}

function selectTopEvents(results: CritiqueResult[]): CandidateEvent[] {
  const passed = results.filter((result) => result.passed);
  const sorted = [...passed].sort((a, b) => {
    const leakDiff = a.scores.leak_risk - b.scores.leak_risk;
    const guessDiff = b.scores.guessability - a.scores.guessability;
    if (Math.abs(guessDiff) > 0.0001) {
      return guessDiff;
    }
    const factualDiff = b.scores.factual - a.scores.factual;
    if (Math.abs(factualDiff) > 0.0001) {
      return factualDiff;
    }
    return leakDiff;
  });

  // Select top events by score, up to MAX_SELECTED_EVENTS
  const selected = sorted.slice(0, MAX_SELECTED_EVENTS).map((result) => result.event);

  return selected;
}

function createUsageSummary(): UsageSummary {
  return {
    generator: emptyUsageTotals(),
    critic: emptyUsageTotals(),
    reviser: emptyUsageTotals(),
    total: emptyUsageTotals(),
  };
}

function emptyUsageTotals(): TokenUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fallbacks: 0,
  };
}

function recordUsage(
  stageTotals: TokenUsageTotals,
  overall: TokenUsageTotals,
  usage: TokenUsage,
  costUsd: number,
  metadata: { cacheHit: boolean; fallbackFrom?: string | null | undefined },
): void {
  addUsage(stageTotals, usage, costUsd, metadata);
  addUsage(overall, usage, costUsd, metadata);
}

function addUsage(
  target: TokenUsageTotals,
  usage: TokenUsage,
  costUsd: number,
  metadata: { cacheHit: boolean; fallbackFrom?: string | null | undefined },
): void {
  target.inputTokens += usage.inputTokens;
  target.outputTokens += usage.outputTokens;
  target.reasoningTokens += usage.reasoningTokens;
  target.totalTokens += usage.totalTokens;
  target.costUsd += costUsd;
  if (metadata.cacheHit) {
    target.cacheHits += 1;
  } else {
    target.cacheMisses += 1;
  }
  if (metadata.fallbackFrom) {
    target.fallbacks += 1;
  }
}

async function executeYearGeneration(ctx: ActionCtx, year: number): Promise<YearGenerationResult> {
  const result = await runGenerationPipeline(year);
  const era = deriveEra(year);

  logStageSuccess("Orchestrator", `Pipeline completed for ${year}`, {
    status: result.status,
    attempts: result.metadata.attempts,
    qualityOverall: result.qualityScores?.overall,
  });

  await ctx.runMutation(internal.generationLogs.logGenerationAttempt, {
    year,
    era,
    status: result.status,
    attempt_count: result.metadata.attempts,
    events_generated: result.status === "success" ? result.events.length : 0,
    token_usage: {
      input: result.usage.total.inputTokens,
      output: result.usage.total.outputTokens,
      reasoning: result.usage.total.reasoningTokens,
      total: result.usage.total.totalTokens,
    },
    cost_usd: result.usage.total.costUsd,
    cache_hits: result.usage.total.cacheHits,
    cache_misses: result.usage.total.cacheMisses,
    fallback_count: result.usage.total.fallbacks,
    error_message: result.status === "failed" ? result.reason : undefined,
    quality_scores: result.qualityScores,
  });

  if (result.status === "success") {
    // Import events with full metadata to enable diversity-aware puzzle selection
    const payload = result.events.map((event) => ({
      event: event.event_text,
      metadata: event.metadata,
    }));
    await ctx.runMutation(internal.events.importYearEventsWithMetadata, {
      year,
      events: payload,
    });
  }

  return result;
}

function clampTargetCount(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 10;
  return Math.max(MIN_TARGET_COUNT, Math.min(MAX_TARGET_COUNT, Math.floor(value)));
}
