import { describe, it, expect, vi } from "vitest";
import type { LLMClient } from "../../../lib/llmClient";
import type { CandidateEvent, CritiqueResult } from "../schemas";
import { critiqueCandidatesForYear } from "../critic";

function mockCandidate(overrides: Partial<CandidateEvent> = {}): CandidateEvent {
  return {
    canonical_title: "Apollo 11",
    event_text: "Neil Armstrong walks on Moon",
    geo: "Moon",
    difficulty_guess: 5,
    confidence: 0.95,
    leak_flags: {
      has_digits: false,
      has_century_terms: false,
      has_spelled_year: false,
    },
    ...overrides,
  };
}

function mockCritique(overrides: Partial<CritiqueResult> = {}): CritiqueResult {
  return {
    event: mockCandidate(),
    passed: true,
    scores: {
      factual: 0.9,
      leak_risk: 0.05,
      ambiguity: 0.1,
      guessability: 0.8,
      diversity: 0.5,
    },
    issues: [],
    rewrite_hints: [],
    ...overrides,
  };
}

function createMockClient(returnValue: CritiqueResult[]): LLMClient {
  return {
    generate: vi.fn().mockResolvedValue({
      data: returnValue,
      rawText: JSON.stringify(returnValue),
      model: "openai/gpt-4o-mini",
      usage: {
        inputTokens: 400,
        outputTokens: 350,
        reasoningTokens: 0,
        totalTokens: 750,
        costUsd: 0.015,
      },
      requestId: "req_critic_test",
    }),
  } as unknown as LLMClient;
}

describe("critiqueCandidatesForYear", () => {
  it("marks deterministic failures as failing even if LLM passes", async () => {
    const candidate = mockCandidate({ event_text: "Battle of 1066 decides realm" });
    const client = createMockClient([mockCritique({ event: candidate })]);

    const result = await critiqueCandidatesForYear({
      year: 1066,
      era: "CE",
      candidates: [candidate],
      llmClient: client,
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].issues).toContain(
      "Contains year leakage (numbers, century terms, or BCE/CE references)",
    );
  });

  it("enforces score thresholds from LLM output", async () => {
    const candidate = mockCandidate();
    const critique = mockCritique({
      scores: { factual: 0.9, leak_risk: 0.5, ambiguity: 0.1, guessability: 0.8, diversity: 0.5 },
      passed: true,
    });
    const client = createMockClient([critique]);

    const result = await critiqueCandidatesForYear({
      year: 1969,
      era: "CE",
      candidates: [candidate],
      llmClient: client,
    });

    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].issues).toContain("Leak risk above 0.15");
  });
});
