import { describe, it, expect, vi } from "vitest";
import type { Gemini3Client } from "../../../lib/gemini3Client";
import type { CandidateEvent, CritiqueResult } from "../schemas";
import { reviseCandidatesForYear } from "../reviser";

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

function mockFailure(overrides: Partial<CritiqueResult> = {}): CritiqueResult {
  return {
    event: mockCandidate(),
    passed: false,
    scores: {
      factual: 0.8,
      leak_risk: 0.2,
      ambiguity: 0.2,
      guessability: 0.5,
      diversity: 0.4,
    },
    issues: ["Leak risk above 0.15"],
    rewrite_hints: ["Remove numbers"],
    ...overrides,
  };
}

function createMockClient(output: CandidateEvent[]): Gemini3Client {
  return {
    generate: vi.fn().mockResolvedValue({
      data: output,
      rawText: JSON.stringify(output),
      usage: {
        inputTokens: 300,
        outputTokens: 250,
        reasoningTokens: 0,
        totalTokens: 550,
      },
      cost: {
        inputUsd: 0.006,
        outputUsd: 0.004,
        reasoningUsd: 0,
        cacheSavingsUsd: 0,
        totalUsd: 0.01,
      },
      metadata: {
        model: "google/gemini-3-pro-preview",
        latencyMs: 1300,
        cacheHit: false,
        requestId: "req_reviser_test",
      },
    }),
  } as unknown as Gemini3Client;
}

describe("reviseCandidatesForYear", () => {
  it("returns sanitized rewrites for failing events", async () => {
    const failing = [
      mockFailure({
        event: mockCandidate({ event_text: "Battle of 1066 decides realm" }),
      }),
    ];
    const rewritten = [
      mockCandidate({
        canonical_title: "  Norman Conquest ",
        event_text: "William defeats rivals at Hastings",
        geo: "  England ",
      }),
    ];
    const client = createMockClient(rewritten);

    const result = await reviseCandidatesForYear({
      failing,
      year: 1066,
      era: "CE",
      llmClient: client,
    });

    expect(result.rewrites).toHaveLength(1);
    expect(result.rewrites[0].canonical_title).toBe("Norman Conquest");
    expect(result.rewrites[0].geo).toBe("England");
    expect(result.llm.model).toBe("google/gemini-3-pro-preview");
  });

  it("short-circuits when no failing events", async () => {
    const result = await reviseCandidatesForYear({ failing: [], year: 1969, era: "CE" });
    expect(result.rewrites).toHaveLength(0);
    expect(result.llm.requestId).toBe("");
  });
});
