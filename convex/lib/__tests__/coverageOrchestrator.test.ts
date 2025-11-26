import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { analyzeCoverageGaps } from "../coverageOrchestrator";
import type { ActionCtx } from "../../_generated/server";

// Mock ActionCtx with runQuery
const createMockCtx = () => {
  return {
    runQuery: vi.fn(),
  } as unknown as ActionCtx;
};

describe("analyzeCoverageGaps", () => {
  let mockCtx: ActionCtx;
  let mockRunQuery: Mock;

  beforeEach(() => {
    mockCtx = createMockCtx();
    mockRunQuery = mockCtx.runQuery as Mock;
  });

  describe("Missing years detection", () => {
    it("identifies years with 0 events as missing", async () => {
      // Arrange: Database has events only for years 1000 and 2000
      mockRunQuery.mockResolvedValue([
        { year: 1000, total: 10, used: 2, available: 8 },
        { year: 2000, total: 12, used: 3, available: 9 },
      ]);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert: All years in range except 1000 and 2000 should be missing
      expect(result.missingYears).toContain(-776); // First year in range
      expect(result.missingYears).toContain(0); // Year 0
      expect(result.missingYears).toContain(500); // Era boundary
      expect(result.missingYears).toContain(1500); // Era boundary
      expect(result.missingYears).toContain(2008); // Last year in range
      expect(result.missingYears).not.toContain(1000);
      expect(result.missingYears).not.toContain(2000);
    });

    it("returns empty missingYears if all years have events", async () => {
      // Arrange: Generate stats for ALL years in range
      const allYearStats = [];
      for (let year = -776; year <= 2008; year++) {
        allYearStats.push({ year, total: 10, used: 2, available: 8 });
      }
      mockRunQuery.mockResolvedValue(allYearStats);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert
      expect(result.missingYears).toEqual([]);
    });
  });

  describe("Insufficient events detection", () => {
    it("identifies years with <6 events as insufficient", async () => {
      // Arrange
      mockRunQuery.mockResolvedValue([
        { year: 1000, total: 5, used: 0, available: 5 }, // Insufficient
        { year: 1001, total: 6, used: 0, available: 6 }, // Sufficient
        { year: 1002, total: 3, used: 1, available: 2 }, // Insufficient
        { year: 1003, total: 10, used: 3, available: 7 }, // Sufficient
      ]);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert
      expect(result.insufficientYears).toContain(1000);
      expect(result.insufficientYears).toContain(1002);
      expect(result.insufficientYears).not.toContain(1001);
      expect(result.insufficientYears).not.toContain(1003);
    });

    it("counts total events, not just available", async () => {
      // Arrange: Year has 8 total but only 2 available (6 used)
      mockRunQuery.mockResolvedValue([{ year: 1500, total: 8, used: 6, available: 2 }]);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert: Not insufficient because total >= 6
      expect(result.insufficientYears).not.toContain(1500);
    });
  });

  describe("Coverage by era calculation", () => {
    it("calculates coverage percentages for each era", async () => {
      // Arrange: Partial coverage in each era
      mockRunQuery.mockResolvedValue([
        // Ancient era: -776 to 500 (1,277 years)
        { year: -100, total: 10, used: 0, available: 10 },
        { year: 0, total: 10, used: 0, available: 10 },
        { year: 500, total: 10, used: 0, available: 10 },
        // Medieval era: 501 to 1499 (999 years)
        { year: 1000, total: 10, used: 0, available: 10 },
        // Modern era: 1500 to 2008 (509 years)
        { year: 1900, total: 10, used: 0, available: 10 },
        { year: 2000, total: 10, used: 0, available: 10 },
      ]);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert: 3/1277 ancient, 1/999 medieval, 2/509 modern
      expect(result.coverageByEra.ancient).toBeCloseTo(3 / 1277, 4);
      expect(result.coverageByEra.medieval).toBeCloseTo(1 / 999, 4);
      expect(result.coverageByEra.modern).toBeCloseTo(2 / 509, 4);
    });

    it("handles 100% coverage in an era", async () => {
      // Arrange: All ancient years (just 3 for testing)
      const ancientYears = [-776, -775, -774];
      mockRunQuery.mockResolvedValue(
        ancientYears.map((year) => ({ year, total: 10, used: 0, available: 10 })),
      );

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert: Should be 3/1277, not 100% (only 3 of 1277 ancient years)
      expect(result.coverageByEra.ancient).toBeLessThan(0.01);
    });

    it("handles 0% coverage in an era", async () => {
      // Arrange: No events in any era
      mockRunQuery.mockResolvedValue([]);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert
      expect(result.coverageByEra.ancient).toBe(0);
      expect(result.coverageByEra.medieval).toBe(0);
      expect(result.coverageByEra.modern).toBe(0);
    });
  });

  describe("Integration: Full gap analysis", () => {
    it("returns comprehensive gap analysis matching success criteria", async () => {
      // Arrange: Simulate current state (674 years with events out of 2,785 total)
      const existingYears = 674;
      const stats = [];
      for (let i = 0; i < existingYears; i++) {
        // Spread across eras
        const year = -776 + Math.floor((i * 2785) / existingYears);
        stats.push({ year, total: 8, used: 2, available: 6 });
      }
      mockRunQuery.mockResolvedValue(stats);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert: Should identify ~2,111 missing years (2,785 - 674)
      expect(result.missingYears.length).toBeGreaterThan(2000);
      expect(result.missingYears.length).toBeLessThan(2200);

      // Assert: Coverage should be ~24% (674 / 2,785)
      const totalCoverage =
        (result.coverageByEra.ancient * 1277 +
          result.coverageByEra.medieval * 999 +
          result.coverageByEra.modern * 509) /
        2785;
      expect(totalCoverage).toBeGreaterThan(0.2);
      expect(totalCoverage).toBeLessThan(0.3);
    });

    it("returns only implemented fields (no lowQualityYears)", async () => {
      // Arrange
      mockRunQuery.mockResolvedValue([{ year: 1000, total: 10, used: 0, available: 10 }]);

      // Act
      const result = await analyzeCoverageGaps(mockCtx);

      // Assert: Interface should not include lowQualityYears
      expect(result).toHaveProperty("missingYears");
      expect(result).toHaveProperty("insufficientYears");
      expect(result).toHaveProperty("coverageByEra");
      expect(result).not.toHaveProperty("lowQualityYears");
    });
  });
});
