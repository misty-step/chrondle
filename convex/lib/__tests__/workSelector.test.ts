import { describe, it, expect } from "vitest";
import {
  getEraBucket,
  pickBalancedYears,
  type EraBucket,
  type YearCandidateSource,
} from "../workSelector";

describe("workSelector helpers", () => {
  describe("getEraBucket", () => {
    it("categorizes eras correctly", () => {
      expect(getEraBucket(-200)).toBe("ancient");
      expect(getEraBucket(476)).toBe("ancient");
      expect(getEraBucket(800)).toBe("medieval");
      expect(getEraBucket(1499)).toBe("medieval");
      expect(getEraBucket(1500)).toBe("modern");
    });

    it("handles ancient boundary (year 500)", () => {
      expect(getEraBucket(500)).toBe("ancient");
      expect(getEraBucket(501)).toBe("medieval");
    });

    it("handles medieval boundary (year 1499-1500)", () => {
      expect(getEraBucket(1499)).toBe("medieval");
      expect(getEraBucket(1500)).toBe("modern");
    });

    it("handles BC years (negative)", () => {
      expect(getEraBucket(-776)).toBe("ancient");
      expect(getEraBucket(-5000)).toBe("ancient");
      expect(getEraBucket(-1)).toBe("ancient");
    });

    it("handles year 0", () => {
      expect(getEraBucket(0)).toBe("ancient");
    });

    it("handles modern years", () => {
      expect(getEraBucket(1800)).toBe("modern");
      expect(getEraBucket(2000)).toBe("modern");
      expect(getEraBucket(2024)).toBe("modern");
    });
  });

  describe("pickBalancedYears", () => {
    it("prefers balanced buckets when selecting", () => {
      const candidates = [
        { year: -100, severity: 3, source: "missing" as YearCandidateSource },
        { year: 800, severity: 3, source: "missing" as YearCandidateSource },
        { year: 1700, severity: 3, source: "missing" as YearCandidateSource },
        { year: 1710, severity: 2, source: "low_quality" as YearCandidateSource },
      ];

      const result = pickBalancedYears(candidates, 3);
      expect(result).toContain(-100);
      expect(result).toContain(800);
      expect(result).toContain(1700);
    });

    it("falls back to priority order when buckets unavailable", () => {
      const candidates = [
        { year: 1600, severity: 3, source: "missing" as YearCandidateSource },
        { year: 1610, severity: 2, source: "low_quality" as YearCandidateSource },
        { year: 1620, severity: 1, source: "fallback" as YearCandidateSource },
      ];

      const result = pickBalancedYears(candidates, 2);
      expect(result).toEqual([1600, 1610]);
    });

    it("returns empty array for count 0", () => {
      const candidates = [{ year: 1600, severity: 3, source: "missing" as YearCandidateSource }];

      const result = pickBalancedYears(candidates, 0);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty candidates", () => {
      const result = pickBalancedYears([], 3);
      expect(result).toEqual([]);
    });

    it("handles request for more years than candidates", () => {
      const candidates = [
        { year: 1600, severity: 3, source: "missing" as YearCandidateSource },
        { year: 1700, severity: 2, source: "low_quality" as YearCandidateSource },
      ];

      const result = pickBalancedYears(candidates, 5);
      expect(result).toHaveLength(2);
      expect(result).toContain(1600);
      expect(result).toContain(1700);
    });

    it("does not select duplicate years", () => {
      const candidates = [
        { year: 1600, severity: 3, source: "missing" as YearCandidateSource },
        { year: 1600, severity: 2, source: "low_quality" as YearCandidateSource },
        { year: 1700, severity: 1, source: "fallback" as YearCandidateSource },
      ];

      const result = pickBalancedYears(candidates, 3);
      expect(result).toHaveLength(2); // Only 2 unique years
      expect(new Set(result).size).toBe(result.length);
    });

    it("selects from all three era buckets when available", () => {
      const candidates = [
        { year: 2000, severity: 1, source: "fallback" as YearCandidateSource }, // modern
        { year: 1200, severity: 1, source: "fallback" as YearCandidateSource }, // medieval
        { year: -100, severity: 1, source: "fallback" as YearCandidateSource }, // ancient
      ];

      const result = pickBalancedYears(candidates, 3);
      expect(result).toHaveLength(3);

      // Should have one from each era
      const eras = result.map(getEraBucket);
      expect(eras).toContain("ancient");
      expect(eras).toContain("medieval");
      expect(eras).toContain("modern");
    });

    it("fills remaining slots from candidates after era balancing", () => {
      const candidates = [
        { year: 100, severity: 3, source: "missing" as YearCandidateSource }, // ancient
        { year: 200, severity: 3, source: "missing" as YearCandidateSource }, // ancient
        { year: 1200, severity: 2, source: "low_quality" as YearCandidateSource }, // medieval
        { year: 1800, severity: 1, source: "fallback" as YearCandidateSource }, // modern
        { year: 1900, severity: 1, source: "fallback" as YearCandidateSource }, // modern
      ];

      const result = pickBalancedYears(candidates, 5);
      expect(result).toHaveLength(5);
      // First 3 should be from different eras, then fill with remaining
    });

    it("respects count limit strictly", () => {
      const candidates = Array.from({ length: 10 }, (_, i) => ({
        year: 1600 + i * 10,
        severity: 10 - i,
        source: "missing" as YearCandidateSource,
      }));

      const result = pickBalancedYears(candidates, 3);
      expect(result).toHaveLength(3);
    });
  });
});
