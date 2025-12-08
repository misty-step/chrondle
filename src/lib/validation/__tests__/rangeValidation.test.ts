import { describe, it, expect } from "vitest";
import {
  validateGuessSubmission,
  validateRangeSubmission,
  calculateRangeWidth,
  rangeContainsTarget,
  normalizeHintCount,
} from "../rangeValidation";
import { GAME_CONFIG } from "@/lib/constants";
import { SCORING_CONSTANTS } from "@/lib/scoring";

describe("rangeValidation", () => {
  describe("validateGuessSubmission", () => {
    const currentYear = 2025;

    describe("valid guesses", () => {
      it("accepts a normal year", () => {
        const result = validateGuessSubmission(1969, 0, currentYear);
        expect(result.valid).toBe(true);
      });

      it("accepts minimum year (-9999)", () => {
        const result = validateGuessSubmission(-9999, 0, currentYear);
        expect(result.valid).toBe(true);
      });

      it("accepts current year", () => {
        const result = validateGuessSubmission(currentYear, 0, currentYear);
        expect(result.valid).toBe(true);
      });

      it("accepts year 0", () => {
        const result = validateGuessSubmission(0, 0, currentYear);
        expect(result.valid).toBe(true);
      });

      it("accepts BC years (negative)", () => {
        const result = validateGuessSubmission(-753, 0, currentYear);
        expect(result.valid).toBe(true);
      });
    });

    describe("invalid guesses", () => {
      it("rejects year below minimum", () => {
        const result = validateGuessSubmission(-10000, 0, currentYear);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0].field).toBe("guess");
          expect(result.errors[0].message).toContain("-9999");
        }
      });

      it("rejects year above current year", () => {
        const result = validateGuessSubmission(3000, 0, currentYear);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0].field).toBe("guess");
          expect(result.errors[0].message).toContain(String(currentYear));
        }
      });

      it("rejects when at max guesses", () => {
        const result = validateGuessSubmission(1969, GAME_CONFIG.MAX_GUESSES, currentYear);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0].field).toBe("guessCount");
          expect(result.errors[0].message).toContain("6 guesses");
        }
      });

      it("returns multiple errors when applicable", () => {
        const result = validateGuessSubmission(-10000, GAME_CONFIG.MAX_GUESSES, currentYear);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors).toHaveLength(2);
        }
      });
    });

    describe("edge cases", () => {
      it("uses current year when not provided", () => {
        // This test verifies default parameter behavior
        const result = validateGuessSubmission(1969, 0);
        expect(result.valid).toBe(true);
      });

      it("accepts guess at MAX_GUESSES - 1", () => {
        const result = validateGuessSubmission(1969, GAME_CONFIG.MAX_GUESSES - 1, currentYear);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe("validateRangeSubmission", () => {
    describe("valid ranges", () => {
      it("accepts a normal range", () => {
        const result = validateRangeSubmission(1960, 1980);
        expect(result.valid).toBe(true);
      });

      it("accepts single-year range", () => {
        const result = validateRangeSubmission(1969, 1969);
        expect(result.valid).toBe(true);
      });

      it("accepts max width range", () => {
        const result = validateRangeSubmission(1800, 1800 + SCORING_CONSTANTS.W_MAX - 1);
        expect(result.valid).toBe(true);
      });

      it("accepts BC ranges (negative years)", () => {
        const result = validateRangeSubmission(-500, -400);
        expect(result.valid).toBe(true);
      });

      it("accepts range spanning BC to AD", () => {
        const result = validateRangeSubmission(-50, 50);
        expect(result.valid).toBe(true);
      });
    });

    describe("invalid ranges", () => {
      it("rejects inverted range (start > end)", () => {
        const result = validateRangeSubmission(1980, 1960);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0].field).toBe("range");
          expect(result.errors[0].message).toContain("Start year must be before");
        }
      });

      it("rejects range exceeding max width", () => {
        const result = validateRangeSubmission(1800, 1800 + SCORING_CONSTANTS.W_MAX);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0].field).toBe("width");
          expect(result.errors[0].message).toContain(String(SCORING_CONSTANTS.W_MAX));
        }
      });

      it("rejects when at max ranges", () => {
        const result = validateRangeSubmission(1960, 1980, GAME_CONFIG.MAX_GUESSES);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors[0].field).toBe("rangeCount");
        }
      });
    });

    describe("edge cases", () => {
      it("early returns on inverted range (skips width check)", () => {
        // When start > end, we should get only one error about ordering
        // (width check is skipped via early return)
        const result = validateRangeSubmission(1980, 1960);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0].field).toBe("range");
        }
      });

      it("skips range count check when undefined", () => {
        const result = validateRangeSubmission(1960, 1980, undefined);
        expect(result.valid).toBe(true);
      });

      it("guarantees width >= 1 when start <= end", () => {
        // This documents the invariant: if start <= end, width is always >= 1
        // Single year range has width = 1
        const result = validateRangeSubmission(1969, 1969);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe("calculateRangeWidth", () => {
    it("calculates width correctly for normal range", () => {
      expect(calculateRangeWidth(1960, 1980)).toBe(21);
    });

    it("returns 1 for single-year range", () => {
      expect(calculateRangeWidth(1969, 1969)).toBe(1);
    });

    it("handles BC ranges", () => {
      expect(calculateRangeWidth(-500, -400)).toBe(101);
    });

    it("handles BC to AD spanning range", () => {
      expect(calculateRangeWidth(-50, 50)).toBe(101);
    });
  });

  describe("rangeContainsTarget", () => {
    it("returns true when target is in range", () => {
      expect(rangeContainsTarget(1960, 1980, 1969)).toBe(true);
    });

    it("returns true when target equals start", () => {
      expect(rangeContainsTarget(1960, 1980, 1960)).toBe(true);
    });

    it("returns true when target equals end", () => {
      expect(rangeContainsTarget(1960, 1980, 1980)).toBe(true);
    });

    it("returns false when target is before range", () => {
      expect(rangeContainsTarget(1960, 1980, 1950)).toBe(false);
    });

    it("returns false when target is after range", () => {
      expect(rangeContainsTarget(1960, 1980, 1990)).toBe(false);
    });

    it("handles BC ranges", () => {
      expect(rangeContainsTarget(-500, -400, -450)).toBe(true);
      expect(rangeContainsTarget(-500, -400, -600)).toBe(false);
    });
  });

  describe("normalizeHintCount", () => {
    it("returns 0 for negative input", () => {
      expect(normalizeHintCount(-1)).toBe(0);
    });

    it("returns input when in valid range", () => {
      expect(normalizeHintCount(3)).toBe(3);
    });

    it("clamps to max when exceeding", () => {
      const maxHint = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS.length - 1;
      expect(normalizeHintCount(100)).toBe(maxHint);
    });

    it("returns 0 for 0 input", () => {
      expect(normalizeHintCount(0)).toBe(0);
    });

    it("handles max valid hint", () => {
      const maxHint = SCORING_CONSTANTS.MAX_SCORES_BY_HINTS.length - 1;
      expect(normalizeHintCount(maxHint)).toBe(maxHint);
    });
  });
});
