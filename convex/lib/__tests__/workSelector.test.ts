import { describe, it, expect } from "vitest";
import { getEraBucket, pickBalancedYears } from "../workSelector";

describe("workSelector helpers", () => {
  it("categorizes eras correctly", () => {
    expect(getEraBucket(-200)).toBe("ancient");
    expect(getEraBucket(476)).toBe("ancient");
    expect(getEraBucket(800)).toBe("medieval");
    expect(getEraBucket(1499)).toBe("medieval");
    expect(getEraBucket(1500)).toBe("modern");
  });

  it("prefers balanced buckets when selecting", () => {
    const candidates = [
      { year: -100, severity: 3, source: "missing" as const },
      { year: 800, severity: 3, source: "missing" as const },
      { year: 1700, severity: 3, source: "missing" as const },
      { year: 1710, severity: 2, source: "low_quality" as const },
    ];

    const result = pickBalancedYears(candidates, 3);
    expect(result).toContain(-100);
    expect(result).toContain(800);
    expect(result).toContain(1700);
  });

  it("falls back to priority order when buckets unavailable", () => {
    const candidates = [
      { year: 1600, severity: 3, source: "missing" as const },
      { year: 1610, severity: 2, source: "low_quality" as const },
      { year: 1620, severity: 1, source: "fallback" as const },
    ];

    const result = pickBalancedYears(candidates, 2);
    expect(result).toEqual([1600, 1610]);
  });
});
