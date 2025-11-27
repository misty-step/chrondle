import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { analyzeCoverageGaps, analyzePuzzleDemand } from "../coverageOrchestrator";
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

describe("analyzePuzzleDemand", () => {
  let mockCtx: ActionCtx;
  let mockRunQuery: Mock;

  beforeEach(() => {
    mockCtx = createMockCtx();
    mockRunQuery = mockCtx.runQuery as Mock;
  });

  describe("Puzzle usage counting", () => {
    it("counts puzzle usage by year", async () => {
      // Arrange: Multiple puzzles using different years
      mockRunQuery.mockResolvedValue([
        { targetYear: 1969 },
        { targetYear: 1945 },
        { targetYear: 1969 }, // Duplicate year
        { targetYear: 2000 },
        { targetYear: 1969 }, // 1969 used 3 times
      ]);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert
      expect(result.selectionFrequency.get(1969)).toBe(3);
      expect(result.selectionFrequency.get(1945)).toBe(1);
      expect(result.selectionFrequency.get(2000)).toBe(1);
    });

    it("returns empty frequency map when no puzzles exist", async () => {
      // Arrange
      mockRunQuery.mockResolvedValue([]);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert
      expect(result.selectionFrequency.size).toBe(0);
      expect(result.highDemandYears).toEqual([]);
    });
  });

  describe("High-demand years identification", () => {
    it("identifies years used more than once as high demand", async () => {
      // Arrange
      mockRunQuery.mockResolvedValue([
        { targetYear: 1969 },
        { targetYear: 1969 },
        { targetYear: 1945 },
        { targetYear: 2000 },
        { targetYear: 2000 },
        { targetYear: 2000 },
      ]);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert: Years with >1 usage
      expect(result.highDemandYears).toContain(1969); // 2 uses
      expect(result.highDemandYears).toContain(2000); // 3 uses
      expect(result.highDemandYears).not.toContain(1945); // Only 1 use
    });

    it("sorts high-demand years by frequency descending", async () => {
      // Arrange
      mockRunQuery.mockResolvedValue([
        { targetYear: 1969 },
        { targetYear: 1969 },
        { targetYear: 2000 },
        { targetYear: 2000 },
        { targetYear: 2000 },
        { targetYear: 1945 },
        { targetYear: 1945 },
        { targetYear: 1945 },
        { targetYear: 1945 },
      ]);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert: Ordered by frequency (1945=4, 2000=3, 1969=2)
      expect(result.highDemandYears).toEqual([1945, 2000, 1969]);
    });
  });

  describe("Demand by era calculation", () => {
    it("calculates total demand by era", async () => {
      // Arrange
      mockRunQuery.mockResolvedValue([
        // Ancient (≤500): 3 puzzles
        { targetYear: -100 },
        { targetYear: 0 },
        { targetYear: 500 },
        // Medieval (501-1499): 2 puzzles
        { targetYear: 1000 },
        { targetYear: 1400 },
        // Modern (≥1500): 4 puzzles
        { targetYear: 1900 },
        { targetYear: 1950 },
        { targetYear: 2000 },
        { targetYear: 2000 }, // Duplicate counts
      ]);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert
      expect(result.demandByEra.ancient).toBe(3);
      expect(result.demandByEra.medieval).toBe(2);
      expect(result.demandByEra.modern).toBe(4);
    });

    it("handles zero demand in some eras", async () => {
      // Arrange: Only modern puzzles
      mockRunQuery.mockResolvedValue([{ targetYear: 1900 }, { targetYear: 2000 }]);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert
      expect(result.demandByEra.ancient).toBe(0);
      expect(result.demandByEra.medieval).toBe(0);
      expect(result.demandByEra.modern).toBe(2);
    });
  });

  describe("Integration: Success criteria", () => {
    it("reveals modern years (1900-2000) have highest demand", async () => {
      // Arrange: Simulate realistic puzzle distribution
      const modernYears = [1900, 1920, 1945, 1969, 1980, 2000];
      const medievalYears = [1066, 1215];
      const ancientYears = [44];

      const puzzles = [
        ...modernYears.flatMap((y) => [{ targetYear: y }, { targetYear: y }]), // 12 modern
        ...medievalYears.map((y) => ({ targetYear: y })), // 2 medieval
        ...ancientYears.map((y) => ({ targetYear: y })), // 1 ancient
      ];

      mockRunQuery.mockResolvedValue(puzzles);

      // Act
      const result = await analyzePuzzleDemand(mockCtx);

      // Assert: Modern era dominates
      expect(result.demandByEra.modern).toBeGreaterThan(result.demandByEra.medieval);
      expect(result.demandByEra.modern).toBeGreaterThan(result.demandByEra.ancient);
      expect(result.demandByEra.modern).toBeGreaterThan(10);
    });
  });
});
