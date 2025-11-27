import { describe, it, expect } from "vitest";
import { calculatePercentile, getMetrics, recordGeneration } from "../metricsService";
import type { GenerationResult } from "../metricsCollector";
import type { Doc } from "../../../_generated/dataModel";

describe("recordGeneration", () => {
  it("inserts generation result into database", async () => {
    const insertedDocs: Record<string, unknown>[] = [];
    const mockCtx = {
      db: {
        insert: async (_table: string, doc: Record<string, unknown>) => {
          insertedDocs.push(doc);
          return "mock-id";
        },
      },
    };

    const result: GenerationResult = {
      year: 1969,
      era: "CE",
      status: "success",
      eventsGenerated: 6,
      tokenUsage: {
        input: 500,
        output: 400,
        reasoning: 100,
        total: 1000,
      },
      costUsd: 0.05,
      durationMs: 1500,
      cacheHits: 1,
      cacheMisses: 0,
      fallbackCount: 0,
    };

    await recordGeneration(mockCtx, result);

    expect(insertedDocs).toHaveLength(1);
    expect(insertedDocs[0]).toMatchObject({
      year: 1969,
      era: "CE",
      status: "success",
      events_generated: 6,
      cost_usd: 0.05,
    });
  });
});

describe("getMetrics", () => {
  it("aggregates metrics across all dimensions", async () => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const mockLogs = [
      {
        _id: "log1" as Doc<"generation_logs">["_id"],
        _creationTime: now,
        year: 1969,
        era: "CE",
        status: "success",
        attempt_count: 1,
        events_generated: 6,
        token_usage: { input: 500, output: 400, total: 900 },
        cost_usd: 0.05,
        timestamp: now - DAY_MS * 3, // 3 days ago
      },
      {
        _id: "log2" as Doc<"generation_logs">["_id"],
        _creationTime: now,
        year: 1066,
        era: "CE",
        status: "failed",
        attempt_count: 1,
        events_generated: 0,
        token_usage: { input: 300, output: 0, total: 300 },
        cost_usd: 0.01,
        error_message: "Year too obscure",
        timestamp: now - DAY_MS * 2, // 2 days ago
      },
      {
        _id: "log3" as Doc<"generation_logs">["_id"],
        _creationTime: now,
        year: 2001,
        era: "CE",
        status: "success",
        attempt_count: 1,
        events_generated: 8,
        token_usage: { input: 600, output: 500, total: 1100 },
        cost_usd: 0.06,
        timestamp: now - DAY_MS * 0.5, // 12 hours ago
      },
    ] as Doc<"generation_logs">[];

    const mockEvents = [
      {
        _id: "evt1" as Doc<"events">["_id"],
        _creationTime: now,
        year: 1969,
        event: "Moon landing",
        puzzleId: undefined, // Unused
        updatedAt: now,
      },
      {
        _id: "evt2" as Doc<"events">["_id"],
        _creationTime: now,
        year: 1969,
        event: "Woodstock",
        puzzleId: "puzzle1" as Doc<"puzzles">["_id"], // Used
        updatedAt: now,
      },
      {
        _id: "evt3" as Doc<"events">["_id"],
        _creationTime: now,
        year: 1500,
        event: "Discovery",
        puzzleId: undefined, // Unused
        updatedAt: now,
      },
      {
        _id: "evt4" as Doc<"events">["_id"],
        _creationTime: now,
        year: 400,
        event: "Ancient event",
        puzzleId: undefined, // Unused
        updatedAt: now,
      },
    ] as Doc<"events">[];

    const mockCtx: {
      db: {
        query: (table: string) => {
          collect: () => Promise<Doc<"events">[]>;
          withIndex: (
            name: string,
            filter: (q: { gte: (field: string, value: number) => unknown }) => unknown,
          ) => {
            collect: () => Promise<Doc<"generation_logs">[]>;
          };
        };
      };
    } = {
      db: {
        query: (table: string) => ({
          collect: async () => (table === "events" ? mockEvents : []),
          withIndex: () => ({
            collect: async () => mockLogs,
          }),
        }),
      },
    };

    const metrics = await getMetrics(mockCtx, "7d");

    // Pool health assertions
    expect(metrics.poolHealth.unusedEvents).toBe(3);
    expect(metrics.poolHealth.daysUntilDepletion).toBe(0); // floor(3/6) = 0
    expect(metrics.poolHealth.yearsReady).toBe(3); // 1969, 1500, 400
    expect(metrics.poolHealth.coverageByEra.ancient).toBe(1); // year 400
    expect(metrics.poolHealth.coverageByEra.medieval).toBe(0);
    expect(metrics.poolHealth.coverageByEra.modern).toBe(2); // years 1969, 1500

    // Cost tracking assertions
    expect(metrics.cost.cost30Day).toBe(0.12); // 0.05 + 0.01 + 0.06
    expect(metrics.cost.costPerEvent).toBeCloseTo(0.12 / 14, 3); // Total cost / total events

    // Quality metrics assertions
    expect(metrics.quality.failureRate).toBeCloseTo(1 / 3, 2);
    expect(metrics.quality.avgQualityScore).toBeCloseTo(2 / 3, 2); // 2 successes out of 3
    expect(metrics.quality.topFailureReasons).toHaveLength(1);
    expect(metrics.quality.topFailureReasons[0].reason).toBe("Year too obscure");

    // Latency metrics (placeholder zeros until duration tracking implemented)
    expect(metrics.latency.p50).toBe(0);
    expect(metrics.latency.p95).toBe(0);
    expect(metrics.latency.avgDuration).toBe(0);

    // Timestamp
    expect(metrics.timestamp).toBeGreaterThan(0);
  });

  it("handles empty logs gracefully", async () => {
    const mockCtx: {
      db: {
        query: (table: string) => {
          collect: () => Promise<Doc<"events">[]>;
          withIndex: (
            name: string,
            filter: (q: { gte: (field: string, value: number) => unknown }) => unknown,
          ) => {
            collect: () => Promise<Doc<"generation_logs">[]>;
          };
        };
      };
    } = {
      db: {
        query: () => ({
          collect: async () => [],
          withIndex: () => ({
            collect: async () => [],
          }),
        }),
      },
    };

    const metrics = await getMetrics(mockCtx, "24h");

    expect(metrics.poolHealth.unusedEvents).toBe(0);
    expect(metrics.cost.costToday).toBe(0);
    expect(metrics.quality.failureRate).toBe(0);
    expect(metrics.quality.topFailureReasons).toHaveLength(0);
  });
});

describe("calculatePercentile", () => {
  it("calculates p50 correctly", () => {
    const values = [100, 200, 300, 400, 500];
    expect(calculatePercentile(values, 0.5)).toBe(300);
  });

  it("calculates p95 correctly", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100
    expect(calculatePercentile(values, 0.95)).toBe(95);
  });

  it("calculates p99 correctly", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(calculatePercentile(values, 0.99)).toBe(99);
  });

  it("handles empty array", () => {
    expect(calculatePercentile([], 0.95)).toBe(0);
  });

  it("handles single value", () => {
    expect(calculatePercentile([42], 0.95)).toBe(42);
  });
});
