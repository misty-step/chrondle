"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { TokenUsage } from "../../lib/llmClient";
import { generateCandidatesForYear } from "./generator";
import { critiqueCandidatesForYear } from "./critic";
import type { CritiqueResult } from "./schemas";
import { reviseCandidatesForYear } from "./reviser";
import type { CandidateEvent, Era } from "./schemas";
import { chooseWorkYears } from "../../lib/workSelector";
import { logStageError, logStageSuccess } from "../../lib/logging";
import { runAlertChecks } from "../../lib/alerts";

const MAX_TOTAL_ATTEMPTS = 4;
const MAX_CRITIC_CYCLES = 2;
const MIN_REQUIRED_EVENTS = 6;
const MAX_SELECTED_EVENTS = 10;

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
    const { years } = await chooseWorkYears(ctx, args.targetCount ?? 3);
    const results = [] as Array<{ year: number; result: YearGenerationResult }>;

    for (const year of years) {
      try {
        const result = await executeYearGeneration(ctx, year);
        results.push({ year, result });
      } catch (error) {
        logStageError("Orchestrator", error, { year });
        results.push({
          year,
          result: {
            status: "failed",
            reason: "insufficient_quality",
            metadata: {
              attempts: 0,
              criticCycles: 0,
              revisions: 0,
              deterministicFailures: 0,
            },
            usage: createUsageSummary(),
          },
        });
      }
    }

    await runAlertChecks(ctx);

    return {
      attemptedYears: results.map((entry) => entry.year),
      successes: results.filter((entry) => entry.result.status === "success").length,
      failures: results.filter((entry) => entry.result.status === "failed").length,
    };
  },
});

export interface TokenUsageTotals {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
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
    }
  | {
      status: "failed";
      reason: FailureReason;
      metadata: PipelineMetadata;
      usage: UsageSummary;
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
  const usage = createUsageSummary();
  let attempts = 0;
  let totalCycles = 0;
  let totalRevisions = 0;
  let totalDeterministicFailures = 0;

  while (attempts < MAX_TOTAL_ATTEMPTS) {
    attempts += 1;

    const generation = await deps.generator({ year, era });
    recordUsage(usage.generator, usage.total, generation.llm.usage);

    let candidates = generation.candidates;
    let cycles = 0;

    while (cycles < MAX_CRITIC_CYCLES) {
      cycles += 1;
      totalCycles += 1;

      const critique = await deps.critic({ year, era, candidates });
      recordUsage(usage.critic, usage.total, critique.llm.usage);
      totalDeterministicFailures += critique.deterministicFailures;

      const passingResults = critique.results.filter((result) => result.passed);

      if (passingResults.length >= MIN_REQUIRED_EVENTS) {
        const selected = selectTopEvents(critique.results);
        if (selected.length >= MIN_REQUIRED_EVENTS) {
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
          };
        }
      }

      const failingResults = critique.results.filter((result) => !result.passed);
      if (!failingResults.length || cycles >= MAX_CRITIC_CYCLES) {
        break;
      }

      const revision = await deps.reviser({ failing: failingResults, year, era });
      recordUsage(usage.reviser, usage.total, revision.llm.usage);
      totalRevisions += 1;

      candidates = rebuildCandidateSet(critique.results, revision.rewrites);
    }
  }

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
  };
}

function recordUsage(
  stageTotals: TokenUsageTotals,
  overall: TokenUsageTotals,
  usage: TokenUsage,
): void {
  addUsage(stageTotals, usage);
  addUsage(overall, usage);
}

function addUsage(target: TokenUsageTotals, usage: TokenUsage): void {
  target.inputTokens += usage.inputTokens;
  target.outputTokens += usage.outputTokens;
  target.reasoningTokens += usage.reasoningTokens;
  target.totalTokens += usage.totalTokens;
  target.costUsd += usage.costUsd ?? 0;
}

async function executeYearGeneration(ctx: ActionCtx, year: number): Promise<YearGenerationResult> {
  const result = await runGenerationPipeline(year);
  const era = deriveEra(year);

  logStageSuccess("Orchestrator", `Pipeline completed for ${year}`, {
    status: result.status,
    attempts: result.metadata.attempts,
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
      total: result.usage.total.totalTokens,
    },
    cost_usd: result.usage.total.costUsd,
    error_message: result.status === "failed" ? result.reason : undefined,
  });

  if (result.status === "success") {
    const payload = result.events.map((event) => event.event_text);
    await ctx.runMutation(internal.events.importYearEvents, {
      year,
      events: payload,
    });
  }

  return result;
}
