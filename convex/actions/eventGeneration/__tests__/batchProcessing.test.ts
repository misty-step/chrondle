import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock internalAction to return the handler directly
vi.mock("../../../_generated/server", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internalAction: (config: any) => ({ handler: config.handler }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (config: any) => ({ handler: config.handler }),
}));

// Mock dependencies to avoid real API calls and "internal spy" issues
vi.mock("../generator", () => ({
  generateCandidatesForYear: vi.fn().mockResolvedValue({
    status: "success",
    candidates: [],
    llm: {
      usage: { totalTokens: 100, inputTokens: 50, outputTokens: 50, reasoningTokens: 0 },
      costUsd: 0.001,
      cacheHit: false,
    },
  }),
}));

vi.mock("../critic", () => ({
  critiqueCandidatesForYear: vi.fn().mockImplementation(async ({ year }) => {
    // Fail specific years to test error handling
    if (year === 1993 || year === 1995) {
      return {
        llm: {
          usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
          costUsd: 0,
          cacheHit: false,
        },
        deterministicFailures: 0,
        // To trigger failure in runGenerationPipeline, we need to simulate behavior that leads to failure
        // But runGenerationPipeline logic depends on the result.
        // Actually, if we want runGenerationPipeline to return "failed", we need it to exhaust attempts.
        // So we should make critique return NO passing results.
        results: [{ passed: false, scores: { leak_risk: 1 } }],
      };
    }
    return {
      results: Array(6).fill({ passed: true, event: {}, scores: { leak_risk: 0 } }),
      llm: {
        usage: { totalTokens: 50, inputTokens: 25, outputTokens: 25, reasoningTokens: 0 },
        costUsd: 0.0005,
        cacheHit: false,
      },
      deterministicFailures: 0,
    };
  }),
}));

vi.mock("../reviser", () => ({
  reviseCandidatesForYear: vi.fn().mockResolvedValue({
    rewrites: [],
    llm: {
      usage: { totalTokens: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      costUsd: 0,
      cacheHit: false,
    },
  }),
}));

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

vi.mock("../../../lib/logging", () => ({
  logStageSuccess: vi.fn(),
  logStageError: vi.fn(),
}));

vi.mock("../../../lib/alerts", () => ({
  runAlertChecks: vi.fn(),
}));

import { generateDailyBatch } from "../orchestrator";

const rateLimiterCalls: number[] = [];

describe("generateDailyBatch integration", () => {
  beforeEach(() => {
    rateLimiterCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("processes 10 years in parallel and aggregates successes and failures", async () => {
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(undefined),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (generateDailyBatch as any).handler(ctx, {});

    expect(result.attemptedYears).toHaveLength(10);
    // Years 1993 and 1995 are set to fail in the critic mock
    // 1990-1999. 1993 is failure. 1995 is failure.
    expect(result.successes).toBe(8);
    expect(result.failures).toBe(2);
    expect(rateLimiterCalls).toHaveLength(10);
  }, 10000); // Increase timeout just in case

  it("continues processing other years when one fails", async () => {
    // This test is essentially covered by the one above, but let's keep it distinct if needed
    // or we can merge them. The logic is identical given the global mocks.
    // We'll verify the specific failure count.

    const ctx = {
      runMutation: vi.fn().mockResolvedValue(undefined),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (generateDailyBatch as any).handler(ctx, {});

    expect(result.failures).toBe(2);
    expect(result.successes).toBe(8);
  });
});
