import { describe, expect, it } from "vitest";
import { getPerformanceTier, getTierColorClass } from "../performanceTier";

// =============================================================================
// getPerformanceTier
// =============================================================================

describe("getPerformanceTier", () => {
  describe("perfect tier (100%)", () => {
    it("returns perfect tier for exactly 100%", () => {
      const result = getPerformanceTier(100);

      expect(result.tier).toBe("perfect");
      expect(result.title).toBe("Perfect Timeline!");
      expect(result.message).toBe("Flawless chronological sense");
    });
  });

  describe("excellent tier (80-99%)", () => {
    it("returns excellent tier for 99%", () => {
      const result = getPerformanceTier(99);

      expect(result.tier).toBe("excellent");
      expect(result.title).toBe("Excellent Work!");
      expect(result.message).toBe("Strong historical knowledge");
    });

    it("returns excellent tier for 80%", () => {
      const result = getPerformanceTier(80);

      expect(result.tier).toBe("excellent");
    });

    it("returns excellent tier for 90%", () => {
      const result = getPerformanceTier(90);

      expect(result.tier).toBe("excellent");
    });
  });

  describe("good tier (60-79%)", () => {
    it("returns good tier for 79%", () => {
      const result = getPerformanceTier(79);

      expect(result.tier).toBe("good");
      expect(result.title).toBe("Good Effort!");
      expect(result.message).toBe("Solid attempt");
    });

    it("returns good tier for 60%", () => {
      const result = getPerformanceTier(60);

      expect(result.tier).toBe("good");
    });

    it("returns good tier for 70%", () => {
      const result = getPerformanceTier(70);

      expect(result.tier).toBe("good");
    });
  });

  describe("fair tier (40-59%)", () => {
    it("returns fair tier for 59%", () => {
      const result = getPerformanceTier(59);

      expect(result.tier).toBe("fair");
      expect(result.title).toBe("Tricky One!");
      expect(result.message).toBe("Room to improve");
    });

    it("returns fair tier for 40%", () => {
      const result = getPerformanceTier(40);

      expect(result.tier).toBe("fair");
    });

    it("returns fair tier for 50%", () => {
      const result = getPerformanceTier(50);

      expect(result.tier).toBe("fair");
    });
  });

  describe("challenging tier (0-39%)", () => {
    it("returns challenging tier for 39%", () => {
      const result = getPerformanceTier(39);

      expect(result.tier).toBe("challenging");
      expect(result.title).toBe("Challenging!");
      expect(result.message).toBe("These were tough events");
    });

    it("returns challenging tier for 0%", () => {
      const result = getPerformanceTier(0);

      expect(result.tier).toBe("challenging");
    });

    it("returns challenging tier for 20%", () => {
      const result = getPerformanceTier(20);

      expect(result.tier).toBe("challenging");
    });

    it("returns challenging tier for 1%", () => {
      const result = getPerformanceTier(1);

      expect(result.tier).toBe("challenging");
    });
  });

  describe("boundary conditions", () => {
    it("handles exact tier boundaries correctly", () => {
      expect(getPerformanceTier(100).tier).toBe("perfect");
      expect(getPerformanceTier(99).tier).toBe("excellent");
      expect(getPerformanceTier(80).tier).toBe("excellent");
      expect(getPerformanceTier(79).tier).toBe("good");
      expect(getPerformanceTier(60).tier).toBe("good");
      expect(getPerformanceTier(59).tier).toBe("fair");
      expect(getPerformanceTier(40).tier).toBe("fair");
      expect(getPerformanceTier(39).tier).toBe("challenging");
    });
  });
});

// =============================================================================
// getTierColorClass
// =============================================================================

describe("getTierColorClass", () => {
  it("returns success color for perfect tier", () => {
    expect(getTierColorClass("perfect")).toBe("text-feedback-success");
  });

  it("returns primary color for excellent tier", () => {
    expect(getTierColorClass("excellent")).toBe("text-body-primary");
  });

  it("returns foreground color for good tier", () => {
    expect(getTierColorClass("good")).toBe("text-foreground");
  });

  it("returns muted color for fair tier", () => {
    expect(getTierColorClass("fair")).toBe("text-muted-foreground");
  });

  it("returns muted color for challenging tier", () => {
    expect(getTierColorClass("challenging")).toBe("text-muted-foreground");
  });
});
