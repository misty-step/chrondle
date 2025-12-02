import { describe, expect, it } from "vitest";
import { getStreakColorClasses } from "../streak-styling";

describe("getStreakColorClasses", () => {
  // =============================================================================
  // No streak (0 or negative)
  // =============================================================================

  describe("no streak tier (0 or negative)", () => {
    it("returns muted colors for streak of 0", () => {
      const result = getStreakColorClasses(0);

      expect(result.textColor).toBe("text-muted-foreground");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBeUndefined();
    });

    it("returns muted colors for negative streak", () => {
      const result = getStreakColorClasses(-5);

      expect(result.textColor).toBe("text-muted-foreground");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // Starting out tier (1-2)
  // =============================================================================

  describe("starting tier (1-2)", () => {
    it("returns foreground colors for streak of 1", () => {
      const result = getStreakColorClasses(1);

      expect(result.textColor).toBe("text-foreground");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBeUndefined();
    });

    it("returns foreground colors for streak of 2", () => {
      const result = getStreakColorClasses(2);

      expect(result.textColor).toBe("text-foreground");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // Building momentum tier (3-6)
  // =============================================================================

  describe("momentum tier (3-6)", () => {
    it("returns info colors with milestone for streak of 3", () => {
      const result = getStreakColorClasses(3);

      expect(result.textColor).toBe("text-status-info");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBe("Building momentum!");
    });

    it("returns info colors without milestone for streak of 4", () => {
      const result = getStreakColorClasses(4);

      expect(result.textColor).toBe("text-status-info");
      expect(result.milestone).toBeUndefined();
    });

    it("returns info colors for streak of 6", () => {
      const result = getStreakColorClasses(6);

      expect(result.textColor).toBe("text-status-info");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // One week+ tier (7-13)
  // =============================================================================

  describe("one week tier (7-13)", () => {
    it("returns success colors with milestone for streak of 7", () => {
      const result = getStreakColorClasses(7);

      expect(result.textColor).toBe("text-feedback-correct");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBe("One week streak! 🔥");
    });

    it("returns success colors without milestone for streak of 8", () => {
      const result = getStreakColorClasses(8);

      expect(result.textColor).toBe("text-feedback-correct");
      expect(result.milestone).toBeUndefined();
    });

    it("returns success colors for streak of 13", () => {
      const result = getStreakColorClasses(13);

      expect(result.textColor).toBe("text-feedback-correct");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // Two weeks+ tier (14-29)
  // =============================================================================

  describe("two weeks tier (14-29)", () => {
    it("returns warning colors with milestone for streak of 14", () => {
      const result = getStreakColorClasses(14);

      expect(result.textColor).toBe("text-status-warning");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBe("Two weeks strong! ⚡");
    });

    it("returns warning colors without milestone for streak of 15", () => {
      const result = getStreakColorClasses(15);

      expect(result.textColor).toBe("text-status-warning");
      expect(result.milestone).toBeUndefined();
    });

    it("returns warning colors for streak of 29", () => {
      const result = getStreakColorClasses(29);

      expect(result.textColor).toBe("text-status-warning");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // One month+ tier (30-99)
  // =============================================================================

  describe("one month tier (30-99)", () => {
    it("returns error colors with champion milestone for streak of 30", () => {
      const result = getStreakColorClasses(30);

      expect(result.textColor).toBe("text-status-error");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBe("One month champion! 🏆");
    });

    it("returns error colors without milestone for streak of 31", () => {
      const result = getStreakColorClasses(31);

      expect(result.textColor).toBe("text-status-error");
      expect(result.milestone).toBeUndefined();
    });

    it("returns error colors with dedication milestone for streak of 50", () => {
      const result = getStreakColorClasses(50);

      expect(result.textColor).toBe("text-status-error");
      expect(result.milestone).toBe("Incredible dedication! 💎");
    });

    it("returns error colors without milestone for streak of 51", () => {
      const result = getStreakColorClasses(51);

      expect(result.textColor).toBe("text-status-error");
      expect(result.milestone).toBeUndefined();
    });

    it("returns error colors for streak of 99", () => {
      const result = getStreakColorClasses(99);

      expect(result.textColor).toBe("text-status-error");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // Elite tier (100+)
  // =============================================================================

  describe("elite tier (100+)", () => {
    it("returns primary colors with century milestone for streak of 100", () => {
      const result = getStreakColorClasses(100);

      expect(result.textColor).toBe("text-body-primary");
      expect(result.borderColor).toBe("border-muted");
      expect(result.milestone).toBe("Century club! 👑");
    });

    it("returns primary colors without milestone for streak of 101", () => {
      const result = getStreakColorClasses(101);

      expect(result.textColor).toBe("text-body-primary");
      expect(result.milestone).toBeUndefined();
    });

    it("returns primary colors for streak of 500", () => {
      const result = getStreakColorClasses(500);

      expect(result.textColor).toBe("text-body-primary");
      expect(result.milestone).toBeUndefined();
    });
  });

  // =============================================================================
  // Boundary conditions
  // =============================================================================

  describe("boundary conditions", () => {
    it("handles tier boundaries correctly", () => {
      // 0 -> muted
      expect(getStreakColorClasses(0).textColor).toBe("text-muted-foreground");
      // 1-2 -> foreground
      expect(getStreakColorClasses(1).textColor).toBe("text-foreground");
      expect(getStreakColorClasses(2).textColor).toBe("text-foreground");
      // 3-6 -> info
      expect(getStreakColorClasses(3).textColor).toBe("text-status-info");
      expect(getStreakColorClasses(6).textColor).toBe("text-status-info");
      // 7-13 -> success
      expect(getStreakColorClasses(7).textColor).toBe("text-feedback-correct");
      expect(getStreakColorClasses(13).textColor).toBe("text-feedback-correct");
      // 14-29 -> warning
      expect(getStreakColorClasses(14).textColor).toBe("text-status-warning");
      expect(getStreakColorClasses(29).textColor).toBe("text-status-warning");
      // 30-99 -> error
      expect(getStreakColorClasses(30).textColor).toBe("text-status-error");
      expect(getStreakColorClasses(99).textColor).toBe("text-status-error");
      // 100+ -> primary
      expect(getStreakColorClasses(100).textColor).toBe("text-body-primary");
    });
  });
});
