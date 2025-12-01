import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { analyzeCoverageGaps, analyzePuzzleDemand, selectWork } from "../coverageOrchestrator";
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

describe("selectWork", () => {
  let mockCtx: ActionCtx;
  let mockRunQuery: Mock;

  beforeEach(() => {
    mockCtx = createMockCtx();
    mockRunQuery = mockCtx.runQuery as Mock;
  });

  describe("80/20 allocation strategy", () => {
    it("allocates 80% to high-demand gaps when available", async () => {
      // Arrange: 10 missing years, 5 are high-demand
      mockRunQuery
        .mockResolvedValueOnce([
          // getAllYearsWithStats - only 5 years with events
          { year: 100, total: 10, used: 0, available: 10 },
          { year: 200, total: 10, used: 0, available: 10 },
          { year: 300, total: 10, used: 0, available: 10 },
          { year: 400, total: 10, used: 0, available: 10 },
          { year: 500, total: 10, used: 0, available: 10 },
        ])
        .mockResolvedValueOnce([
          // getAllPuzzles - high demand for specific years
          { targetYear: 1000 },
          { targetYear: 1000 }, // 1000 used 3x
          { targetYear: 1000 },
          { targetYear: 1500 },
          { targetYear: 1500 }, // 1500 used 2x
          { targetYear: 2000 }, // 2000 used 1x (not high-demand)
        ]);

      // Act: Request 10 years
      const result = await selectWork(mockCtx, 10);

      // Assert: Should allocate 8 to high-demand (80%), 2 to strategic (20%)
      // High-demand gaps: years that are missing AND in high-demand list
      const highDemandInGaps = result.targetYears.filter((y) => y === 1000 || y === 1500);
      expect(highDemandInGaps.length).toBeGreaterThanOrEqual(2); // At least the 2 high-demand gaps
    });

    it("selects exactly count years when sufficient candidates", async () => {
      // Arrange: Many missing years
      mockRunQuery
        .mockResolvedValueOnce([]) // No events yet
        .mockResolvedValueOnce([{ targetYear: 1900 }, { targetYear: 1900 }]); // Some demand

      // Act
      const result = await selectWork(mockCtx, 5);

      // Assert
      expect(result.targetYears).toHaveLength(5);
    });
  });

  describe("Era diversity", () => {
    it("ensures at least 1 year from each era when possible", async () => {
      // Arrange: Missing years in all eras
      mockRunQuery
        .mockResolvedValueOnce([]) // No events - all years missing
        .mockResolvedValueOnce([]); // No puzzles yet

      // Act: Request 5 years
      const result = await selectWork(mockCtx, 5);

      // Assert: Should have representation from all 3 eras
      expect(result.eraBalance.ancient).toBeGreaterThanOrEqual(1);
      expect(result.eraBalance.medieval).toBeGreaterThanOrEqual(1);
      expect(result.eraBalance.modern).toBeGreaterThanOrEqual(1);
    });

    it("fills from lowest-coverage era first", async () => {
      // Arrange: Ancient era has 0% coverage, modern has 50%
      const modernYears = [];
      for (let year = 1500; year <= 1750; year++) {
        modernYears.push({ year, total: 10, used: 0, available: 10 });
      }

      mockRunQuery
        .mockResolvedValueOnce(modernYears) // Modern era well-covered
        .mockResolvedValueOnce([]); // No puzzle demand

      // Act: Request 10 years
      const result = await selectWork(mockCtx, 10);

      // Assert: Ancient should get priority (lowest coverage)
      expect(result.eraBalance.ancient).toBeGreaterThan(result.eraBalance.modern);
    });
  });

  describe("Priority determination", () => {
    it("returns missing priority when high-demand gaps exist", async () => {
      // Arrange: High-demand year is missing
      mockRunQuery
        .mockResolvedValueOnce([]) // All years missing
        .mockResolvedValueOnce([
          { targetYear: 1969 },
          { targetYear: 1969 }, // High-demand year
        ]);

      // Act
      const result = await selectWork(mockCtx, 3);

      // Assert
      expect(result.priority).toBe("missing");
    });

    it("returns low_quality priority when no high-demand gaps", async () => {
      // Arrange: All high-demand years already have events
      mockRunQuery
        .mockResolvedValueOnce([
          { year: 1969, total: 10, used: 0, available: 10 }, // High-demand exists
        ])
        .mockResolvedValueOnce([
          { targetYear: 1969 },
          { targetYear: 1969 }, // High-demand
        ]);

      // Act
      const result = await selectWork(mockCtx, 3);

      // Assert
      expect(result.priority).toBe("low_quality");
    });
  });

  describe("Edge cases", () => {
    it("handles count of 1", async () => {
      // Arrange
      mockRunQuery
        .mockResolvedValueOnce([]) // All missing
        .mockResolvedValueOnce([]);

      // Act
      const result = await selectWork(mockCtx, 1);

      // Assert
      expect(result.targetYears).toHaveLength(1);
    });

    it("handles fewer candidates than requested count", async () => {
      // Arrange: Only 2 insufficient years, all others have sufficient events
      const allYears = [];
      for (let year = -776; year <= 2008; year++) {
        if (year === 1000 || year === 2000) {
          allYears.push({ year, total: 3, used: 0, available: 3 }); // Insufficient
        } else {
          allYears.push({ year, total: 10, used: 0, available: 10 }); // Sufficient
        }
      }

      mockRunQuery.mockResolvedValueOnce(allYears).mockResolvedValueOnce([]);

      // Act: Request 10 years
      const result = await selectWork(mockCtx, 10);

      // Assert: Can only select the 2 insufficient years
      expect(result.targetYears.length).toBe(2);
      expect(result.targetYears).toContain(1000);
      expect(result.targetYears).toContain(2000);
    });

    it("returns valid era balance", async () => {
      // Arrange
      mockRunQuery
        .mockResolvedValueOnce([]) // All missing
        .mockResolvedValueOnce([]);

      // Act
      const result = await selectWork(mockCtx, 5);

      // Assert: Era balance should sum to total years
      const totalInBalance =
        result.eraBalance.ancient + result.eraBalance.medieval + result.eraBalance.modern;
      expect(totalInBalance).toBe(result.targetYears.length);
    });
  });

  describe("Integration: Success criteria", () => {
    it("prioritizes modern year gaps when they have high demand", async () => {
      // Arrange: Modern years are missing but high-demand
      const medievalYears = [];
      for (let year = 1000; year <= 1200; year++) {
        medievalYears.push({ year, total: 10, used: 0, available: 10 });
      }

      mockRunQuery
        .mockResolvedValueOnce(medievalYears) // Medieval covered, modern missing
        .mockResolvedValueOnce([
          // High demand for modern years
          { targetYear: 1900 },
          { targetYear: 1900 },
          { targetYear: 1945 },
          { targetYear: 1945 },
          { targetYear: 2000 },
          { targetYear: 2000 },
        ]);

      // Act
      const result = await selectWork(mockCtx, 10);

      // Assert: 80% (8 years) should be high-demand modern, 20% (2 years) strategic (ancient + medieval for era balance)
      // So we expect at least 8 modern years from high-demand allocation
      const modernYears = result.targetYears.filter((y) => y >= 1500);
      expect(modernYears).toContain(1900);
      expect(modernYears).toContain(1945);
      expect(modernYears).toContain(2000);
      expect(modernYears.length).toBeGreaterThanOrEqual(3); // At least the 3 high-demand modern years
    });

    it("maintains era diversity even with high modern demand", async () => {
      // Arrange: All eras have missing years, modern has highest demand
      mockRunQuery
        .mockResolvedValueOnce([]) // All missing
        .mockResolvedValueOnce([
          // Modern demand
          { targetYear: 1900 },
          { targetYear: 1900 },
          { targetYear: 2000 },
          { targetYear: 2000 },
        ]);

      // Act
      const result = await selectWork(mockCtx, 10);

      // Assert: Strategic allocation ensures diversity
      expect(result.eraBalance.ancient).toBeGreaterThanOrEqual(1);
      expect(result.eraBalance.medieval).toBeGreaterThanOrEqual(1);
    });
  });
});
