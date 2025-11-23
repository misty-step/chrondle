import { describe, it, expect } from "vitest";
import { convertToInternalYear, convertFromInternalYear, formatEraYear } from "../eraUtils";

describe("Era Conversion Smoke Tests", () => {
  it("era conversion handles full range", () => {
    // Just verify it works, don't time it
    expect(convertToInternalYear(776, "BC")).toBe(-776);
    expect(convertFromInternalYear(-776)).toEqual({ year: 776, era: "BC" });
    expect(formatEraYear(1969, "AD")).toBe("1969 AD");
  });

  it("handles edge cases correctly", () => {
    // BC year 1
    expect(convertToInternalYear(1, "BC")).toBe(-1);
    expect(convertFromInternalYear(-1)).toEqual({ year: 1, era: "BC" });

    // AD year 1
    expect(convertToInternalYear(1, "AD")).toBe(1);
    expect(convertFromInternalYear(1)).toEqual({ year: 1, era: "AD" });

    // AD year 0 (special case)
    expect(convertToInternalYear(0, "AD")).toBe(0);
    expect(convertFromInternalYear(0)).toEqual({ year: 0, era: "AD" });
  });

  it("formats years correctly", () => {
    expect(formatEraYear(776, "BC")).toBe("776 BC");
    expect(formatEraYear(1969, "AD")).toBe("1969 AD");
    expect(formatEraYear(1, "BC")).toBe("1 BC");
    expect(formatEraYear(2024, "AD")).toBe("2024 AD");
  });
});
