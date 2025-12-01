import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createGemini3Client } from "../gemini3Client";
import { generateCandidatesForYear } from "../../actions/eventGeneration/generator";
import { critiqueCandidatesForYear } from "../../actions/eventGeneration/critic";
import type { CandidateEvent } from "../../actions/eventGeneration/schemas";

type CacheStatus = "HIT" | "MISS" | null;

const apiKey = "test-openrouter-key";

function buildCandidate(index: number): CandidateEvent {
  return {
    canonical_title: `Event ${index} headline`,
    event_text: "Historic milestone shapes global trajectory",
    geo: "Global",
    difficulty_guess: 3,
    confidence: 0.9,
    leak_flags: {
      has_digits: false,
      has_century_terms: false,
      has_spelled_year: false,
    },
    metadata: {
      difficulty: 3,
      category: ["science", "culture"],
      era: "modern",
      fame_level: 4,
      tags: ["apollo", "space", "cold war"],
    },
  };
}

function successResponse(payload: unknown, cacheStatus: CacheStatus = null): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      get: (key: string) => {
        if (!cacheStatus) return null;
        return key.toLowerCase().includes("cache") ? cacheStatus : null;
      },
    },
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function errorResponse(status = 500, message = "Server error"): Response {
  return {
    ok: false,
    status,
    statusText: "Error",
    text: vi.fn().mockResolvedValue(message),
  } as unknown as Response;
}

describe("Gemini 3 migration integration", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = apiKey;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("generates 1969 events with metadata and tracks cost end-to-end", async () => {
    const generatorCandidates = Array.from({ length: 12 }, (_, i) => buildCandidate(i));
    const generatorPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              year: { value: 1969, era: "CE", digits: 4 },
              candidates: generatorCandidates,
            }),
          },
        },
      ],
      usage: {
        input_tokens: 800,
        output_tokens: 400,
        output_tokens_details: { reasoning_tokens: 120 },
      },
      model: "google/gemini-3-pro-preview",
    };

    const criticPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify(
              generatorCandidates.map((candidate) => ({
                event: candidate,
                passed: true,
                scores: {
                  factual: 0.9,
                  leak_risk: 0.05,
                  ambiguity: 0.1,
                  guessability: 0.8,
                  diversity: 0.7,
                },
                issues: [],
                rewrite_hints: [],
              })),
            ),
          },
        },
      ],
      usage: {
        input_tokens: 600,
        output_tokens: 300,
        output_tokens_details: { reasoning_tokens: 0 },
      },
      model: "google/gemini-3-flash-preview",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successResponse(generatorPayload, "MISS"))
      .mockResolvedValueOnce(successResponse(criticPayload, "HIT"));
    vi.stubGlobal("fetch", fetchMock);

    const generatorClient = createGemini3Client({
      apiKey,
      maxAttempts: 1,
      jitterRatio: 0,
      cache_system_prompt: false,
    });
    const criticClient = createGemini3Client({
      apiKey,
      maxAttempts: 1,
      jitterRatio: 0,
      cache_system_prompt: false,
      model: "google/gemini-3-flash-preview",
    });

    const generation = await generateCandidatesForYear({
      year: 1969,
      era: "CE",
      llmClient: generatorClient,
    });

    const critique = await critiqueCandidatesForYear({
      year: 1969,
      era: "CE",
      candidates: generation.candidates,
      llmClient: criticClient,
    });

    expect(generation.candidates).toHaveLength(12);
    expect(generation.candidates.every((c) => c.metadata && c.metadata.tags?.length)).toBe(true);
    expect(critique.results.every((r) => r.passed)).toBe(true);
    expect(generation.llm.model).toBe("google/gemini-3-pro-preview");
    expect(critique.llm.model).toBe("google/gemini-3-flash-preview");
    expect(generation.llm.costUsd).toBeCloseTo(0.0064, 6); // (800 input + 400 output) pricing
    expect(critique.llm.costUsd).toBeCloseTo(0.0048, 6);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to GPT-5-mini when Gemini 3 fails", async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => buildCandidate(i));
    const fallbackPayload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              year: { value: 1969, era: "CE", digits: 4 },
              candidates,
            }),
          },
        },
      ],
      usage: {
        input_tokens: 200,
        output_tokens: 100,
        output_tokens_details: { reasoning_tokens: 0 },
      },
      model: "openai/gpt-5-mini",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500, "primary failed"))
      .mockResolvedValueOnce(successResponse(fallbackPayload, "MISS"));
    vi.stubGlobal("fetch", fetchMock);

    const generatorClient = createGemini3Client({
      apiKey,
      maxAttempts: 1,
      jitterRatio: 0,
      cache_system_prompt: false,
      fallbackModel: "openai/gpt-5-mini",
    });

    const result = await generateCandidatesForYear({
      year: 1969,
      era: "CE",
      llmClient: generatorClient,
    });

    expect(result.llm.model).toBe("openai/gpt-5-mini");
    expect(result.llm.fallbackFrom).toBe("google/gemini-3-pro-preview");
    expect(result.llm.costUsd).toBeCloseTo(0.0016, 6);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
