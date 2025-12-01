import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { YearGenerationResult, UsageSummary } from "../orchestrator";
import { generateDailyBatch } from "../orchestrator";

const rateLimiterCalls: number[] = [];

vi.mock("../../../lib/coverageOrchestrator", () => ({
  selectWork: vi.fn().mockResolvedValue({
    targetYears: Array.from({ length: 10 }, (_, i) => 1990 + i),
    priority: "missing",
    eraBalance: { ancient: 0, medieval: 0, modern: 10 },
  }),
}));

vi.mock("../../../lib/rateLimiter", () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    execute: async <T>(fn: () => Promise<T>) => {
      rateLimiterCalls.push(Date.now());
      return fn();
    },
  })),
}));

function makeUsage(costUsd: number): UsageSummary {
  const base = {
    inputTokens: 100,
    outputTokens: 80,
    reasoningTokens: 0,
    totalTokens: 180,
    costUsd,
    cacheHits: 0,
    cacheMisses: 0,
    fallbacks: 0,
  };

  return {
    generator: { ...base },
    critic: { ...base },
    reviser: { ...base },
    total: { ...base },
  };
}

describe("generateDailyBatch integration", () => {
  beforeEach(() => {
    rateLimiterCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("processes 10 years in parallel and aggregates successes and failures", async () => {
    const runGenerationPipeline = vi
      .spyOn(await import("../orchestrator"), "runGenerationPipeline")
      .mockImplementation(async (year: number): Promise<YearGenerationResult> => {
        if (year === 1993) {
          return {
            status: "failed",
            reason: "insufficient_quality",
            metadata: { attempts: 1, criticCycles: 0, revisions: 0, deterministicFailures: 0 },
            usage: makeUsage(0.0),
          };
        }

        return {
          status: "success",
          events: [],
          metadata: {
            attempts: 1,
            criticCycles: 1,
            revisions: 0,
            deterministicFailures: 0,
            selectedCount: 6,
          },
          usage: makeUsage(0.01),
        };
      });

    const ctx = {
      runMutation: vi.fn().mockResolvedValue(undefined),
    } as unknown as Parameters<typeof generateDailyBatch.handler>[0];

    const result = await generateDailyBatch.handler(ctx, {});

    expect(result.attemptedYears).toHaveLength(10);
    expect(result.successes).toBe(9);
    expect(result.failures).toBe(1);
    expect(runGenerationPipeline).toHaveBeenCalledTimes(10);
    expect(rateLimiterCalls).toHaveLength(10);
  });

  it("continues processing other years when one fails", async () => {
    const runGenerationPipeline = vi
      .spyOn(await import("../orchestrator"), "runGenerationPipeline")
      .mockImplementation(async (year: number): Promise<YearGenerationResult> => {
        return year === 1995
          ? {
              status: "failed",
              reason: "insufficient_quality",
              metadata: { attempts: 2, criticCycles: 1, revisions: 1, deterministicFailures: 0 },
              usage: makeUsage(0.0),
            }
          : {
              status: "success",
              events: [],
              metadata: {
                attempts: 1,
                criticCycles: 1,
                revisions: 0,
                deterministicFailures: 0,
                selectedCount: 6,
              },
              usage: makeUsage(0.01),
            };
      });

    const ctx = {
      runMutation: vi.fn().mockResolvedValue(undefined),
    } as unknown as Parameters<typeof generateDailyBatch.handler>[0];

    const result = await generateDailyBatch.handler(ctx, {});

    expect(result.failures).toBe(1);
    expect(result.successes).toBe(9);
    expect(runGenerationPipeline).toHaveBeenCalledTimes(10);
  });
});
