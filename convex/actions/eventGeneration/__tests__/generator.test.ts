import { describe, it, expect, vi } from "vitest";
import type { LLMClient } from "../../../lib/llmClient";
import type { GeneratorOutput } from "../schemas";
import { GeneratorOutputSchema } from "../schemas";
import { generateCandidatesForYear, type GeneratorActionResult } from "../generator";

function createMockClient(data: GeneratorOutput): LLMClient {
  return {
    generate: vi.fn().mockResolvedValue({
      data,
      rawText: JSON.stringify(data),
      model: "openai/gpt-4o-mini",
      usage: {
        inputTokens: 500,
        outputTokens: 400,
        reasoningTokens: 0,
        totalTokens: 900,
        costUsd: 0.02,
      },
      requestId: "req_test",
    }),
  } as unknown as LLMClient;
}

describe("generateCandidatesForYear", () => {
  it("returns sanitized candidates and LLM metadata", async () => {
    const payload: GeneratorOutput = {
      year: { value: 1969, era: "CE", digits: 4 },
      candidates: [
        {
          canonical_title: "  Apollo 11 Moon Landing  ",
          event_text: "Neil Armstrong steps onto lunar surface",
          geo: "  Moon ",
          difficulty_guess: 5,
          confidence: 0.98,
          leak_flags: {
            has_digits: false,
            has_century_terms: false,
            has_spelled_year: false,
          },
        },
      ],
    };

    const mockClient = createMockClient(payload);
    const result = await generateCandidatesForYear({
      year: 1969,
      era: "CE",
      llmClient: mockClient,
    });

    expect(mockClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({ schema: GeneratorOutputSchema }),
    );
    expect(result.year).toEqual({ value: 1969, era: "CE", digits: 4 });
    expect(result.candidates[0].canonical_title).toBe("Apollo 11 Moon Landing");
    expect(result.candidates[0].geo).toBe("Moon");
    expect(result.llm.model).toBe("openai/gpt-4o-mini");
    expect(result.llm.usage.totalTokens).toBe(900);
  });

  it("normalizes BCE years and preserves digits", async () => {
    const payload: GeneratorOutput = {
      year: { value: -44, era: "BCE", digits: 2 },
      candidates: new Array(12).fill(null).map((_, index) => ({
        canonical_title: `Event ${index}`,
        event_text: "Julius Caesar faces conspirators",
        geo: "Rome",
        difficulty_guess: 3,
        confidence: 0.9,
        leak_flags: {
          has_digits: false,
          has_century_terms: false,
          has_spelled_year: false,
        },
      })),
    };

    const mockClient = createMockClient(payload);
    const result: GeneratorActionResult = await generateCandidatesForYear({
      year: -44,
      era: "BCE",
      llmClient: mockClient,
    });

    expect(result.year).toEqual({ value: -44, era: "BCE", digits: 2 });
    expect(result.candidates).toHaveLength(12);
  });
});
