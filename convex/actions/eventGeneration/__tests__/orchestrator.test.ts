import { describe, it, expect, vi } from "vitest";
import type { CandidateEvent, CritiqueResult } from "../schemas";
import type { GeneratorActionResult } from "../generator";
import type { CriticActionResult } from "../critic";
import type { ReviserActionResult } from "../reviser";
import type { TokenUsage } from "../../../lib/llmClient";
import { runGenerationPipeline, type YearGenerationResult } from "../orchestrator";

const BASE_USAGE: TokenUsage = {
  inputTokens: 100,
  outputTokens: 80,
  reasoningTokens: 0,
  totalTokens: 180,
  costUsd: 0.005,
};

function mockUsage(partial: Partial<TokenUsage> = {}): TokenUsage {
  return { ...BASE_USAGE, ...partial };
}

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

function mockCritiqueResult(
  candidate: CandidateEvent,
  overrides: Partial<CritiqueResult> = {},
): CritiqueResult {
  return {
    event: candidate,
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

describe("runGenerationPipeline", () => {
  it("succeeds when critic passes enough candidates on first attempt", async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => mockCandidate(i));
    const generatorResult: GeneratorActionResult = {
      year: { value: 1969, era: "CE", digits: 4 },
      candidates,
      llm: { requestId: "gen", model: "model", usage: mockUsage() },
    };

    const criticResult: CriticActionResult = {
      results: candidates.map((candidate) => mockCritiqueResult(candidate)),
      llm: { requestId: "crit", model: "model", usage: mockUsage() },
      deterministicFailures: 0,
    };

    const result = await runGenerationPipeline(1969, {
      generator: vi.fn().mockResolvedValue(generatorResult),
      critic: vi.fn().mockResolvedValue(criticResult),
      reviser: vi.fn(),
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.events.length).toBeGreaterThanOrEqual(6);
      expect(result.metadata.attempts).toBe(1);
      expect(result.metadata.criticCycles).toBe(1);
    }
  });

  it("invokes reviser when not enough events pass initially", async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => mockCandidate(i));
    const generator = vi.fn().mockResolvedValue({
      year: { value: 1200, era: "CE", digits: 4 },
      candidates,
      llm: { requestId: "gen", model: "model", usage: mockUsage() },
    } satisfies GeneratorActionResult);

    const failingResults = candidates.map((candidate, index) =>
      mockCritiqueResult(candidate, {
        passed: index < 4,
        rewrite_hints: index >= 4 ? ["Improve clue"] : [],
      }),
    );

    const passingResults = candidates.map((candidate) =>
      mockCritiqueResult(candidate, { passed: true }),
    );

    const critic = vi
      .fn()
      .mockResolvedValueOnce({
        results: failingResults,
        llm: { requestId: "crit1", model: "model", usage: mockUsage({ totalTokens: 200 }) },
        deterministicFailures: 2,
      } satisfies CriticActionResult)
      .mockResolvedValueOnce({
        results: passingResults,
        llm: { requestId: "crit2", model: "model", usage: mockUsage({ totalTokens: 220 }) },
        deterministicFailures: 0,
      } satisfies CriticActionResult);

    const reviserOutput: ReviserActionResult = {
      rewrites: candidates,
      llm: { requestId: "rev", model: "model", usage: mockUsage({ totalTokens: 150 }) },
    };

    const reviser = vi.fn().mockResolvedValue(reviserOutput);

    const result = await runGenerationPipeline(1200, {
      generator,
      critic,
      reviser,
    });

    expect(critic).toHaveBeenCalledTimes(2);
    expect(reviser).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.metadata.revisions).toBe(1);
      expect(result.metadata.criticCycles).toBe(2);
    }
  });

  it("fails after exhausting attempts without enough passing events", async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => mockCandidate(i));
    const generator = vi.fn().mockResolvedValue({
      year: { value: 500, era: "CE", digits: 3 },
      candidates,
      llm: { requestId: "gen", model: "model", usage: mockUsage() },
    } satisfies GeneratorActionResult);

    const critic = vi.fn().mockResolvedValue({
      results: candidates.map((candidate, index) =>
        mockCritiqueResult(candidate, { passed: index < 4 }),
      ),
      llm: { requestId: "crit", model: "model", usage: mockUsage() },
      deterministicFailures: 0,
    } satisfies CriticActionResult);

    const reviser = vi.fn().mockResolvedValue({
      rewrites: candidates,
      llm: { requestId: "rev", model: "model", usage: mockUsage() },
    } satisfies ReviserActionResult);

    const result = (await runGenerationPipeline(500, {
      generator,
      critic,
      reviser,
    })) as YearGenerationResult;

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.metadata.attempts).toBe(4);
    }
  });
});
