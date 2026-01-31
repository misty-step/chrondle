import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  convertToInternalYear,
  convertFromInternalYear,
  isValidEraYear,
  formatEraYear,
  parseEraYearString,
  getEraYearRange,
  adjustYearWithinEra,
  isAmbiguousYear,
} from "../eraUtils";

describe("eraUtils", () => {
  describe("convertToInternalYear", () => {
    it("should convert BC years to negative internal format", () => {
      expect(convertToInternalYear(776, "BC")).toBe(-776);
      expect(convertToInternalYear(1, "BC")).toBe(-1);
      expect(convertToInternalYear(3000, "BC")).toBe(-3000);
      expect(convertToInternalYear(450, "BC")).toBe(-450);
    });

    it("should convert AD years to positive internal format", () => {
      expect(convertToInternalYear(1, "AD")).toBe(1);
      expect(convertToInternalYear(1969, "AD")).toBe(1969);
      expect(convertToInternalYear(2024, "AD")).toBe(2024);
      expect(convertToInternalYear(476, "AD")).toBe(476);
    });

    it("should handle year 0 edge case", () => {
      expect(convertToInternalYear(0, "BC")).toBe(0);
      expect(convertToInternalYear(0, "AD")).toBe(0);
    });

    describe("with negative input warning", () => {
      let consoleSpy: any;

      beforeEach(() => {
        consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      });

      afterEach(() => {
        consoleSpy.mockRestore();
      });

      it("should warn and convert negative years to positive", () => {
        expect(convertToInternalYear(-776, "BC")).toBe(-776);
        expect(consoleSpy).toHaveBeenCalledWith(
          "[WARN] convertToInternalYear: Year should be positive in UI representation",
        );

        consoleSpy.mockClear();
        expect(convertToInternalYear(-100, "AD")).toBe(100);
        expect(consoleSpy).toHaveBeenCalledWith(
          "[WARN] convertToInternalYear: Year should be positive in UI representation",
        );
      });
    });
  });

  describe("convertFromInternalYear", () => {
    it("should convert negative internal years to BC format", () => {
      expect(convertFromInternalYear(-776)).toEqual({ year: 776, era: "BC" });
      expect(convertFromInternalYear(-1)).toEqual({ year: 1, era: "BC" });
      expect(convertFromInternalYear(-3000)).toEqual({ year: 3000, era: "BC" });
    });

    it("should convert positive internal years to AD format", () => {
      expect(convertFromInternalYear(1)).toEqual({ year: 1, era: "AD" });
      expect(convertFromInternalYear(1969)).toEqual({ year: 1969, era: "AD" });
      expect(convertFromInternalYear(2024)).toEqual({ year: 2024, era: "AD" });
    });

    it("should treat year 0 as AD", () => {
      expect(convertFromInternalYear(0)).toEqual({ year: 0, era: "AD" });
    });

    it("should handle large years correctly", () => {
      expect(convertFromInternalYear(-10000)).toEqual({
        year: 10000,
        era: "BC",
      });
      expect(convertFromInternalYear(5000)).toEqual({ year: 5000, era: "AD" });
    });
  });

  describe("isValidEraYear", () => {
    it("should validate BC years within range", () => {
      expect(isValidEraYear(0, "BC")).toBe(true); // 0 is valid for BC and AD
      expect(isValidEraYear(1, "BC")).toBe(true);
      expect(isValidEraYear(776, "BC")).toBe(true);
      expect(isValidEraYear(3000, "BC")).toBe(true);
    });

    it("should reject BC years outside range", () => {
      expect(isValidEraYear(3001, "BC")).toBe(false);
      expect(isValidEraYear(10000, "BC")).toBe(false);
    });

    it("should validate AD years within range", () => {
      expect(isValidEraYear(0, "AD")).toBe(true); // 0 is valid for AD
      expect(isValidEraYear(1, "AD")).toBe(true);
      expect(isValidEraYear(1969, "AD")).toBe(true);
      expect(isValidEraYear(2024, "AD")).toBe(true);
    });

    it("should reject AD years outside range", () => {
      expect(isValidEraYear(3000, "AD")).toBe(false); // Assuming MAX_YEAR < 3000
      expect(isValidEraYear(10000, "AD")).toBe(false);
    });

    it("should reject negative years for both eras", () => {
      expect(isValidEraYear(-1, "BC")).toBe(false);
      expect(isValidEraYear(-100, "AD")).toBe(false);
      expect(isValidEraYear(-776, "BC")).toBe(false);
    });
  });

  describe("formatEraYear", () => {
    it("should format BC years correctly", () => {
      expect(formatEraYear(776, "BC")).toBe("776 BC");
      expect(formatEraYear(1, "BC")).toBe("1 BC");
      expect(formatEraYear(3000, "BC")).toBe("3000 BC");
    });

    it("should format AD years correctly", () => {
      expect(formatEraYear(1969, "AD")).toBe("1969 AD");
      expect(formatEraYear(1, "AD")).toBe("1 AD");
      expect(formatEraYear(476, "AD")).toBe("476 AD");
    });

    it("should handle year 0", () => {
      expect(formatEraYear(0, "BC")).toBe("0 BC");
      expect(formatEraYear(0, "AD")).toBe("0 AD");
    });

    it("should ensure positive display even with negative input", () => {
      expect(formatEraYear(-776, "BC")).toBe("776 BC");
      expect(formatEraYear(-100, "AD")).toBe("100 AD");
    });
  });

  describe("parseEraYearString", () => {
    it("should parse BC year strings", () => {
      expect(parseEraYearString("776 BC")).toEqual({ year: 776, era: "BC" });
      expect(parseEraYearString("1 BC")).toEqual({ year: 1, era: "BC" });
      expect(parseEraYearString("3000 BC")).toEqual({ year: 3000, era: "BC" });
    });

    it("should parse AD year strings", () => {
      expect(parseEraYearString("1969 AD")).toEqual({ year: 1969, era: "AD" });
      expect(parseEraYearString("1 AD")).toEqual({ year: 1, era: "AD" });
      expect(parseEraYearString("476 AD")).toEqual({ year: 476, era: "AD" });
    });

    it("should handle BCE/CE notation and normalize to BC/AD", () => {
      expect(parseEraYearString("776 BCE")).toEqual({ year: 776, era: "BC" });
      expect(parseEraYearString("1969 CE")).toEqual({ year: 1969, era: "AD" });
      expect(parseEraYearString("450 bce")).toEqual({ year: 450, era: "BC" });
      expect(parseEraYearString("2024 ce")).toEqual({ year: 2024, era: "AD" });
    });

    it("should handle whitespace variations", () => {
      expect(parseEraYearString("776BC")).toEqual({ year: 776, era: "BC" });
      expect(parseEraYearString("1969    AD")).toEqual({
        year: 1969,
        era: "AD",
      });
      expect(parseEraYearString("  450 BC  ")).toEqual({
        year: 450,
        era: "BC",
      });
    });

    it("should be case insensitive", () => {
      expect(parseEraYearString("776 bc")).toEqual({ year: 776, era: "BC" });
      expect(parseEraYearString("1969 ad")).toEqual({ year: 1969, era: "AD" });
      expect(parseEraYearString("100 Bc")).toEqual({ year: 100, era: "BC" });
      expect(parseEraYearString("500 Ad")).toEqual({ year: 500, era: "AD" });
    });

    it("should return null for invalid formats", () => {
      expect(parseEraYearString("")).toBe(null);
      expect(parseEraYearString("invalid")).toBe(null);
      expect(parseEraYearString("776")).toBe(null);
      expect(parseEraYearString("BC 776")).toBe(null);
      expect(parseEraYearString("-776 BC")).toBe(null);
      expect(parseEraYearString("776 XY")).toBe(null);
      expect(parseEraYearString("abc BC")).toBe(null);
    });
  });

  describe("getEraYearRange", () => {
    it("should return correct range for BC era", () => {
      const bcRange = getEraYearRange("BC");
      expect(bcRange.min).toBe(1);
      expect(bcRange.max).toBe(3000); // Math.abs(GAME_CONFIG.MIN_YEAR)
    });

    it("should return correct range for AD era", () => {
      const adRange = getEraYearRange("AD");
      expect(adRange.min).toBe(0);
      expect(adRange.max).toBeGreaterThan(2020); // Current year
      expect(adRange.max).toBeLessThan(3000); // Reasonable upper bound
    });
  });

  describe("adjustYearWithinEra", () => {
    it("should increment year within BC bounds", () => {
      expect(adjustYearWithinEra(500, "BC", 1)).toBe(501);
      expect(adjustYearWithinEra(500, "BC", 10)).toBe(510);
      expect(adjustYearWithinEra(2990, "BC", 5)).toBe(2995);
    });

    it("should decrement year within BC bounds", () => {
      expect(adjustYearWithinEra(500, "BC", -1)).toBe(499);
      expect(adjustYearWithinEra(500, "BC", -10)).toBe(490);
      expect(adjustYearWithinEra(10, "BC", -5)).toBe(5);
    });

    it("should clamp to BC minimum", () => {
      expect(adjustYearWithinEra(5, "BC", -10)).toBe(1);
      expect(adjustYearWithinEra(1, "BC", -1)).toBe(1);
      expect(adjustYearWithinEra(2, "BC", -5)).toBe(1);
    });

    it("should clamp to BC maximum", () => {
      expect(adjustYearWithinEra(2995, "BC", 10)).toBe(3000);
      expect(adjustYearWithinEra(3000, "BC", 1)).toBe(3000);
      expect(adjustYearWithinEra(2999, "BC", 5)).toBe(3000);
    });

    it("should increment year within AD bounds", () => {
      expect(adjustYearWithinEra(1969, "AD", 1)).toBe(1970);
      expect(adjustYearWithinEra(2020, "AD", 4)).toBe(2024);
      expect(adjustYearWithinEra(0, "AD", 100)).toBe(100);
    });

    it("should decrement year within AD bounds", () => {
      expect(adjustYearWithinEra(1969, "AD", -1)).toBe(1968);
      expect(adjustYearWithinEra(100, "AD", -50)).toBe(50);
      expect(adjustYearWithinEra(5, "AD", -5)).toBe(0);
    });

    it("should clamp to AD minimum", () => {
      expect(adjustYearWithinEra(5, "AD", -10)).toBe(0);
      expect(adjustYearWithinEra(0, "AD", -1)).toBe(0);
    });

    it("should clamp to AD maximum", () => {
      const adRange = getEraYearRange("AD");
      expect(adjustYearWithinEra(adRange.max - 5, "AD", 10)).toBe(adRange.max);
      expect(adjustYearWithinEra(adRange.max, "AD", 1)).toBe(adRange.max);
    });
  });

  describe("isAmbiguousYear", () => {
    it("should identify ambiguous years (1-1000)", () => {
      expect(isAmbiguousYear(1)).toBe(true);
      expect(isAmbiguousYear(500)).toBe(true);
      expect(isAmbiguousYear(776)).toBe(true);
      expect(isAmbiguousYear(999)).toBe(true);
      expect(isAmbiguousYear(1000)).toBe(true);
    });

    it("should not identify non-ambiguous years", () => {
      expect(isAmbiguousYear(0)).toBe(false);
      expect(isAmbiguousYear(1001)).toBe(false);
      expect(isAmbiguousYear(1969)).toBe(false);
      expect(isAmbiguousYear(2024)).toBe(false);
      expect(isAmbiguousYear(3000)).toBe(false);
    });

    it("should handle negative years", () => {
      expect(isAmbiguousYear(-100)).toBe(false);
      expect(isAmbiguousYear(-1)).toBe(false);
    });
  });

  describe("Round-trip conversion tests", () => {
    it("should correctly round-trip BC years", () => {
      const testYears = [1, 100, 776, 1500, 3000];
      testYears.forEach((year) => {
        const internal = convertToInternalYear(year, "BC");
        const result = convertFromInternalYear(internal);
        expect(result).toEqual({ year, era: "BC" });
      });
    });

    it("should correctly round-trip AD years", () => {
      const testYears = [1, 100, 476, 1969, 2024];
      testYears.forEach((year) => {
        const internal = convertToInternalYear(year, "AD");
        const result = convertFromInternalYear(internal);
        expect(result).toEqual({ year, era: "AD" });
      });
    });
  });
});
