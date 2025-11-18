import { describe, it, expect, vi } from "vitest";
import {
  runGenerationPipeline,
  type YearGenerationResult,
} from "../actions/eventGeneration/orchestrator";
import type { GeneratorActionResult } from "../actions/eventGeneration/generator";
import type { CriticActionResult } from "../actions/eventGeneration/critic";
import type { ReviserActionResult } from "../actions/eventGeneration/reviser";
import type { CandidateEvent } from "../actions/eventGeneration/schemas";
import type { TokenUsage } from "../lib/llmClient";

const BASE_USAGE: TokenUsage = {
  inputTokens: 400,
  outputTokens: 300,
  reasoningTokens: 0,
  totalTokens: 700,
  costUsd: 0.02,
};

function mockCandidate(index: number, overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    canonical_title: `Event ${index}`,
    event_text: `Clue ${index}`,
    geo: "World",
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

describe("eventGeneration integration", () => {
  it("generates events end-to-end when critic eventually passes", async () => {
    const generatorCandidates = Array.from({ length: 12 }, (_, i) => mockCandidate(i));

    const generator: GeneratorActionResult = {
      year: { value: 1969, era: "CE", digits: 4 },
      candidates: generatorCandidates,
      llm: { requestId: "gen", model: "model", usage: BASE_USAGE },
    };

    const failingCritique: CriticActionResult = {
      results: generatorCandidates.map((candidate, index) => ({
        event: candidate,
        passed: index < 4,
        scores: {
          factual: 0.8,
          leak_risk: 0.3,
          ambiguity: 0.2,
          guessability: 0.5,
          diversity: 0.4,
        },
        issues: ["Leak risk"],
        rewrite_hints: ["Fix leak"],
      })),
      deterministicFailures: 1,
      llm: { requestId: "crit1", model: "model", usage: BASE_USAGE },
    };

    const passingCritique: CriticActionResult = {
      results: generatorCandidates.map((candidate) => ({
        event: candidate,
        passed: true,
        scores: {
          factual: 0.95,
          leak_risk: 0.05,
          ambiguity: 0.1,
          guessability: 0.7,
          diversity: 0.6,
        },
        issues: [],
        rewrite_hints: [],
      })),
      deterministicFailures: 0,
      llm: { requestId: "crit2", model: "model", usage: BASE_USAGE },
    };

    const reviserOutput: ReviserActionResult = {
      rewrites: generatorCandidates.map((candidate, index) =>
        index < 4 ? mockCandidate(index, { event_text: `Revised clue ${index}` }) : candidate,
      ),
      llm: { requestId: "rev", model: "model", usage: BASE_USAGE },
    };

    const deps = {
      generator: vi.fn().mockResolvedValue(generator),
      critic: vi.fn().mockResolvedValueOnce(failingCritique).mockResolvedValueOnce(passingCritique),
      reviser: vi.fn().mockResolvedValue(reviserOutput),
    };

    const result = (await runGenerationPipeline(1969, deps)) as YearGenerationResult;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.events.length).toBeGreaterThanOrEqual(6);
      expect(result.metadata.attempts).toBe(1);
      expect(result.metadata.revisions).toBe(1);
    }
  });
});
