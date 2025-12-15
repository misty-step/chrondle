import { describe, it, expect } from "vitest";
import { computeQualityScores, type QualityScores } from "../qualityScores";
import type { CritiqueResult, CandidateEvent } from "../../actions/eventGeneration/schemas";

/**
 * Test helpers
 */
function createCandidateEvent(overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    canonical_title: "Test Event",
    event_text: "A significant event occurs in the world",
    geo: "Global",
    difficulty_guess: 3,
    confidence: 0.8,
    leak_flags: {
      has_digits: false,
      has_century_terms: false,
      has_spelled_year: false,
    },
    ...overrides,
  };
}

function createCritiqueResult(
  overrides: Partial<CritiqueResult> & { event?: Partial<CandidateEvent> } = {},
): CritiqueResult {
  const { event: eventOverrides, ...rest } = overrides;
  return {
    event: createCandidateEvent(eventOverrides),
    passed: true,
    scores: {
      factual: 0.9,
      leak_risk: 0.1,
      ambiguity: 0.2,
      guessability: 0.7,
      diversity: 0.8,
    },
    issues: [],
    rewrite_hints: [],
    ...rest,
  };
}

describe("computeQualityScores", () => {
  describe("empty inputs", () => {
    it("returns zeros for empty critiques array", () => {
      const result = computeQualityScores({ critiques: [], selected: [] });

      expect(result.version).toBe(1);
      expect(result.candidateCount).toBe(0);
      expect(result.passCount).toBe(0);
      expect(result.selectedCount).toBe(0);
      expect(result.overall).toBe(0);
      expect(result.avg.factual).toBe(0);
      expect(result.selectedAvg.factual).toBe(0);
    });
  });

  describe("basic computation", () => {
    it("computes correct counts", () => {
      const critiques = [
        createCritiqueResult({ passed: true }),
        createCritiqueResult({ passed: true }),
        createCritiqueResult({ passed: false }),
      ];
      const selected = [critiques[0].event, critiques[1].event];

      const result = computeQualityScores({ critiques, selected });

      expect(result.candidateCount).toBe(3);
      expect(result.passCount).toBe(2);
      expect(result.selectedCount).toBe(2);
    });

    it("computes average scores across all candidates", () => {
      const critiques = [
        createCritiqueResult({
          scores: {
            factual: 0.8,
            leak_risk: 0.1,
            ambiguity: 0.2,
            guessability: 0.6,
            diversity: 0.7,
          },
        }),
        createCritiqueResult({
          scores: {
            factual: 1.0,
            leak_risk: 0.0,
            ambiguity: 0.1,
            guessability: 0.8,
            diversity: 0.9,
          },
        }),
      ];

      const result = computeQualityScores({ critiques, selected: [] });

      // Averages: factual = 0.9, leak_risk = 0.05, ambiguity = 0.15, guessability = 0.7
      expect(result.avg.factual).toBeCloseTo(0.9);
      expect(result.avg.leak_risk).toBeCloseTo(0.05);
      expect(result.avg.ambiguity).toBeCloseTo(0.15);
      expect(result.avg.guessability).toBeCloseTo(0.7);
    });
  });

  describe("selected average", () => {
    it("computes selectedAvg from matched events", () => {
      const event1 = createCandidateEvent({ event_text: "Event One occurs" });
      const event2 = createCandidateEvent({ event_text: "Event Two occurs" });
      const event3 = createCandidateEvent({ event_text: "Event Three occurs" });

      const critiques = [
        createCritiqueResult({
          event: event1,
          scores: {
            factual: 0.8,
            leak_risk: 0.1,
            ambiguity: 0.2,
            guessability: 0.6,
            diversity: 0.7,
          },
        }),
        createCritiqueResult({
          event: event2,
          scores: {
            factual: 1.0,
            leak_risk: 0.0,
            ambiguity: 0.0,
            guessability: 0.9,
            diversity: 0.9,
          },
        }),
        createCritiqueResult({
          event: event3,
          scores: {
            factual: 0.5,
            leak_risk: 0.5,
            ambiguity: 0.5,
            guessability: 0.3,
            diversity: 0.5,
          },
        }),
      ];

      // Only select the first two (high quality)
      const selected = [event1, event2];

      const result = computeQualityScores({ critiques, selected });

      // selectedAvg should only include event1 and event2
      expect(result.selectedAvg.factual).toBeCloseTo(0.9); // (0.8 + 1.0) / 2
      expect(result.selectedAvg.guessability).toBeCloseTo(0.75); // (0.6 + 0.9) / 2
    });

    it("falls back to avg when no selected events match", () => {
      const critiques = [
        createCritiqueResult({
          event: createCandidateEvent({ event_text: "Critique event" }),
        }),
      ];
      const selected = [createCandidateEvent({ event_text: "Different event" })];

      const result = computeQualityScores({ critiques, selected });

      // selectedAvg should fall back to avg since no matches
      expect(result.selectedAvg).toEqual(result.avg);
    });
  });

  describe("overall score", () => {
    it("computes weighted overall score correctly", () => {
      // Formula: 0.35*factual + 0.35*guessability + 0.2*(1-leak_risk) + 0.1*(1-ambiguity)
      const event = createCandidateEvent({ event_text: "Test event" });
      const critiques = [
        createCritiqueResult({
          event,
          scores: {
            factual: 1.0,
            leak_risk: 0.0,
            ambiguity: 0.0,
            guessability: 1.0,
            diversity: 1.0,
          },
        }),
      ];
      const selected = [event];

      const result = computeQualityScores({ critiques, selected });

      // Perfect scores: 0.35*1 + 0.35*1 + 0.2*(1-0) + 0.1*(1-0) = 0.35 + 0.35 + 0.2 + 0.1 = 1.0
      expect(result.overall).toBe(1);
    });

    it("penalizes high leak_risk", () => {
      const event = createCandidateEvent({ event_text: "Leaky event" });
      const critiques = [
        createCritiqueResult({
          event,
          scores: {
            factual: 1.0,
            leak_risk: 1.0, // Maximum leak risk
            ambiguity: 0.0,
            guessability: 1.0,
            diversity: 1.0,
          },
        }),
      ];
      const selected = [event];

      const result = computeQualityScores({ critiques, selected });

      // 0.35*1 + 0.35*1 + 0.2*(1-1) + 0.1*(1-0) = 0.35 + 0.35 + 0 + 0.1 = 0.8
      expect(result.overall).toBe(0.8);
    });

    it("clamps overall to [0, 1]", () => {
      const event = createCandidateEvent({ event_text: "Edge case" });
      const critiques = [
        createCritiqueResult({
          event,
          scores: {
            factual: 0.0,
            leak_risk: 1.0,
            ambiguity: 1.0,
            guessability: 0.0,
            diversity: 0.0,
          },
        }),
      ];
      const selected = [event];

      const result = computeQualityScores({ critiques, selected });

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });
  });

  describe("version field", () => {
    it("always returns version 1", () => {
      const result = computeQualityScores({ critiques: [], selected: [] });
      expect(result.version).toBe(1);

      const result2 = computeQualityScores({
        critiques: [createCritiqueResult()],
        selected: [],
      });
      expect(result2.version).toBe(1);
    });
  });

  describe("diversity handling", () => {
    it("includes diversity in avg when present", () => {
      const critiques = [
        createCritiqueResult({
          scores: {
            factual: 0.9,
            leak_risk: 0.1,
            ambiguity: 0.2,
            guessability: 0.7,
            diversity: 0.6,
          },
        }),
        createCritiqueResult({
          scores: {
            factual: 0.9,
            leak_risk: 0.1,
            ambiguity: 0.2,
            guessability: 0.7,
            diversity: 0.8,
          },
        }),
      ];

      const result = computeQualityScores({ critiques, selected: [] });

      expect(result.avg.diversity).toBeCloseTo(0.7);
    });

    it("omits diversity from avg when not present in any critique", () => {
      const critiques = [
        createCritiqueResult({
          scores: { factual: 0.9, leak_risk: 0.1, ambiguity: 0.2, guessability: 0.7 } as any,
        }),
      ];

      const result = computeQualityScores({ critiques, selected: [] });

      expect(result.avg.diversity).toBeUndefined();
    });
  });
});
