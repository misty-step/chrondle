/**
 * Tests for Convex observability query exports.
 *
 * Note: These tests verify the module exports the expected query functions.
 * The underlying metricsService.getMetrics() is tested in lib/observability/__tests__/metricsService.test.ts
 * Convex query wrappers are thin integration layers that don't require extensive testing.
 */

import { describe, it, expect } from "vitest";

describe("observability queries", () => {
  it("exports all expected query functions", async () => {
    const observability = await import("../observability");

    // Verify all expected query exports exist
    expect(observability.getMetricsQuery).toBeDefined();
    expect(observability.getPoolHealthQuery).toBeDefined();
    expect(observability.getCostMetricsQuery).toBeDefined();
    expect(observability.getQualityMetricsQuery).toBeDefined();

    // Verify they are functions (Convex query wrappers)
    expect(typeof observability.getMetricsQuery).toBe("function");
    expect(typeof observability.getPoolHealthQuery).toBe("function");
    expect(typeof observability.getCostMetricsQuery).toBe("function");
    expect(typeof observability.getQualityMetricsQuery).toBe("function");
  });
});
