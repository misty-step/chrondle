import { describe, it, expect } from "vitest";
import {
  formatYearWithOptions,
  formatYearWithEra,
  formatYearStandard,
  formatYearRange,
  formatYearDistance,
  formatCentury,
  formatEra,
  isSameEra,
  getEraDescription,
  formatYear,
} from "../displayFormatting";

describe("Display Formatting Utilities", () => {
  describe("formatYearWithOptions", () => {
    it("formats BC years with standard style", () => {
      expect(formatYearWithOptions(-776)).toBe("776 BC");
      expect(formatYearWithOptions(-1)).toBe("1 BC");
      expect(formatYearWithOptions(-3000)).toBe("3000 BC");
    });

    it("formats AD years with standard style", () => {
      expect(formatYearWithOptions(1969)).toBe("1969 AD");
      expect(formatYearWithOptions(1)).toBe("1 AD");
      expect(formatYearWithOptions(2024)).toBe("2024 AD");
    });

    it("formats with abbreviated style", () => {
      expect(formatYearWithOptions(-776, { style: "abbreviated" })).toBe("776 B");
      expect(formatYearWithOptions(1969, { style: "abbreviated" })).toBe("1969 A");
    });

    it("formats with BCE/CE style", () => {
      expect(formatYearWithOptions(-776, { style: "bce-ce" })).toBe("776 BCE");
      expect(formatYearWithOptions(1969, { style: "bce-ce" })).toBe("1969 CE");
    });

    it("formats with compact style", () => {
      expect(formatYearWithOptions(-776, { style: "compact" })).toBe("776bc");
      expect(formatYearWithOptions(1969, { style: "compact" })).toBe("1969ad");
    });

    it("excludes era when includeEra is false", () => {
      expect(formatYearWithOptions(-776, { includeEra: false })).toBe("776");
      expect(formatYearWithOptions(1969, { includeEra: false })).toBe("1969");
    });

    it("applies lowercase transformation", () => {
      expect(formatYearWithOptions(-776, { lowercase: true })).toBe("776 bc");
      expect(formatYearWithOptions(1969, { lowercase: true })).toBe("1969 ad");
    });

    it("handles year 0 as AD", () => {
      expect(formatYearWithOptions(0)).toBe("0 AD");
    });
  });

  describe("formatYearWithEra", () => {
    it("formats BC years correctly", () => {
      expect(formatYearWithEra(776, "BC")).toBe("776 BC");
      expect(formatYearWithEra(1, "BC")).toBe("1 BC");
    });

    it("formats AD years correctly", () => {
      expect(formatYearWithEra(1969, "AD")).toBe("1969 AD");
      expect(formatYearWithEra(1, "AD")).toBe("1 AD");
    });

    it("applies formatting options", () => {
      expect(formatYearWithEra(776, "BC", { style: "bce-ce" })).toBe("776 BCE");
      expect(formatYearWithEra(1969, "AD", { style: "compact" })).toBe("1969ad");
    });
  });

  describe("formatYearStandard", () => {
    it("maintains backward compatibility", () => {
      expect(formatYearStandard(-776)).toBe("776 BC");
      expect(formatYearStandard(1969)).toBe("1969 AD");
    });
  });

  describe("formatYear export alias", () => {
    it("works as backward compatible alias", () => {
      expect(formatYear(-776)).toBe("776 BC");
      expect(formatYear(1969)).toBe("1969 AD");
    });
  });

  describe("formatYearRange", () => {
    it("formats ranges within same era efficiently", () => {
      expect(formatYearRange(-776, -500)).toBe("776–500 BC");
      expect(formatYearRange(100, 200)).toBe("100–200 AD");
    });

    it("formats ranges across eras", () => {
      expect(formatYearRange(-100, 100)).toBe("100 BC – 100 AD");
      expect(formatYearRange(-776, 1969)).toBe("776 BC – 1969 AD");
    });

    it("applies formatting options", () => {
      expect(formatYearRange(-776, -500, { style: "bce-ce" })).toBe("776–500 BCE");
      expect(formatYearRange(100, 200, { style: "compact" })).toBe("100–200ad");
    });

    it("handles single year range", () => {
      expect(formatYearRange(1969, 1969)).toBe("1969–1969 AD");
    });
  });

  describe("formatYearDistance", () => {
    it("formats exact match", () => {
      expect(formatYearDistance(0)).toBe("exact");
    });

    it("formats single year", () => {
      expect(formatYearDistance(1)).toBe("1 year");
      expect(formatYearDistance(-1)).toBe("1 year");
    });

    it("formats small distances precisely", () => {
      expect(formatYearDistance(5)).toBe("5 years");
      expect(formatYearDistance(9)).toBe("9 years");
    });

    it("rounds medium distances", () => {
      expect(formatYearDistance(23)).toBe("about 25 years");
      expect(formatYearDistance(47)).toBe("about 50 years");
    });

    it("rounds large distances", () => {
      expect(formatYearDistance(234)).toBe("about 250 years");
      expect(formatYearDistance(876)).toBe("about 900 years");
      expect(formatYearDistance(1234)).toBe("about 1200 years");
    });
  });

  describe("formatCentury", () => {
    it("formats BC centuries correctly", () => {
      expect(formatCentury(-776)).toBe("8th century BC");
      expect(formatCentury(-100)).toBe("1st century BC");
      expect(formatCentury(-2000)).toBe("20th century BC");
    });

    it("formats AD centuries correctly", () => {
      expect(formatCentury(100)).toBe("1st century AD");
      expect(formatCentury(476)).toBe("5th century AD");
      expect(formatCentury(1969)).toBe("20th century AD");
      expect(formatCentury(2024)).toBe("21st century AD");
    });

    it("handles century boundaries", () => {
      expect(formatCentury(1)).toBe("1st century AD");
      expect(formatCentury(101)).toBe("2nd century AD");
      expect(formatCentury(1901)).toBe("20th century AD");
      expect(formatCentury(2001)).toBe("21st century AD");
    });

    it("handles ordinal suffixes correctly", () => {
      expect(formatCentury(1100)).toBe("11th century AD");
      expect(formatCentury(1200)).toBe("12th century AD");
      expect(formatCentury(1300)).toBe("13th century AD");
      expect(formatCentury(2100)).toBe("21st century AD");
      expect(formatCentury(2200)).toBe("22nd century AD");
      expect(formatCentury(2300)).toBe("23rd century AD");
    });
  });

  describe("formatEra", () => {
    it("formats standard era", () => {
      expect(formatEra("BC")).toBe("BC");
      expect(formatEra("AD")).toBe("AD");
    });

    it("formats abbreviated era", () => {
      expect(formatEra("BC", "abbreviated")).toBe("B");
      expect(formatEra("AD", "abbreviated")).toBe("A");
    });

    it("formats BCE/CE style", () => {
      expect(formatEra("BC", "bce-ce")).toBe("BCE");
      expect(formatEra("AD", "bce-ce")).toBe("CE");
    });

    it("formats compact style", () => {
      expect(formatEra("BC", "compact")).toBe("bc");
      expect(formatEra("AD", "compact")).toBe("ad");
    });
  });

  describe("isSameEra", () => {
    it("identifies same BC era", () => {
      expect(isSameEra(-776, -500)).toBe(true);
      expect(isSameEra(-1, -3000)).toBe(true);
    });

    it("identifies same AD era", () => {
      expect(isSameEra(100, 200)).toBe(true);
      expect(isSameEra(1, 2024)).toBe(true);
      expect(isSameEra(0, 100)).toBe(true);
    });

    it("identifies different eras", () => {
      expect(isSameEra(-100, 100)).toBe(false);
      expect(isSameEra(-1, 1)).toBe(false);
    });
  });

  describe("getEraDescription", () => {
    it("returns full description for BC", () => {
      expect(getEraDescription("BC")).toBe("Before Christ");
    });

    it("returns full description for AD", () => {
      expect(getEraDescription("AD")).toBe("Anno Domini");
    });
  });
});
