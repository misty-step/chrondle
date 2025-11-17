import { describe, it, expect } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { calculateEventPoolHealth, summarizeGenerationLogs } from "../generationLogs";

describe("generationLogs helpers", () => {
  it("summarizes daily logs with averages", () => {
    const logs = [
      {
        year: 1969,
        era: "CE",
        status: "success",
        attempt_count: 2,
        events_generated: 8,
        token_usage: { input: 1000, output: 800, total: 1800 },
        cost_usd: 0.35,
        error_message: undefined,
        timestamp: Date.now(),
      },
      {
        year: 44,
        era: "BCE",
        status: "failed",
        attempt_count: 4,
        events_generated: 0,
        token_usage: { input: 800, output: 400, total: 1200 },
        cost_usd: 0.2,
        error_message: "Leakage detected",
        timestamp: Date.now(),
      },
    ] as unknown as ReadonlyArray<Doc<"generation_logs">>;

    const stats = summarizeGenerationLogs(logs);

    expect(stats.totalYears).toBe(2);
    expect(stats.successfulYears).toBe(1);
    expect(stats.failedYears).toBe(1);
    expect(stats.eventsGenerated).toBe(8);
    expect(stats.totalCost).toBeCloseTo(0.55, 5);
    expect(stats.avgTokensPerYear).toBeCloseTo(1500, 5);
  });

  it("calculates event pool health across eras", () => {
    const events = [
      { year: -500, puzzleId: undefined },
      { year: 100, puzzleId: undefined },
      { year: 800, puzzleId: undefined },
      { year: 1600, puzzleId: undefined },
      { year: 1700, puzzleId: "somePuzzleId" },
    ] as unknown as ReadonlyArray<Doc<"events">>;

    const health = calculateEventPoolHealth(events);

    expect(health.totalEvents).toBe(5);
    expect(health.unusedEvents).toBe(4);
    expect(health.usedEvents).toBe(1);
    expect(health.daysUntilDepletion).toBe(Math.floor(4 / 6));
    expect(health.coverageByEra.ancient).toBe(2);
    expect(health.coverageByEra.medieval).toBe(1);
    expect(health.coverageByEra.modern).toBe(1);
  });
});
