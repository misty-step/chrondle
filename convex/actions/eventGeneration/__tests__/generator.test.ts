import { describe, it, expect, vi } from "vitest";
import type { Gemini3Client } from "../../../lib/gemini3Client";
import type { GeneratorOutput } from "../schemas";
import { GeneratorOutputSchema } from "../schemas";
import { generateCandidatesForYear, type GeneratorActionResult } from "../generator";

function createMockClient(data: GeneratorOutput): Gemini3Client {
  return {
    generate: vi.fn().mockResolvedValue({
      data,
      rawText: JSON.stringify(data),
      usage: {
        inputTokens: 500,
        outputTokens: 400,
        reasoningTokens: 0,
        totalTokens: 900,
      },
      cost: {
        inputUsd: 0.01,
        outputUsd: 0.01,
        reasoningUsd: 0,
        cacheSavingsUsd: 0,
        totalUsd: 0.02,
      },
      metadata: {
        model: "google/gemini-3-pro-preview",
        latencyMs: 1500,
        cacheHit: false,
        requestId: "req_test",
      },
    }),
  } as unknown as Gemini3Client;
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
    expect(result.llm.model).toBe("google/gemini-3-pro-preview");
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

  describe("enhanced prompts for sparse years", () => {
    it("adds BCE context for ancient years", async () => {
      const payload: GeneratorOutput = {
        year: { value: -44, era: "BCE", digits: 2 },
        candidates: [
          {
            canonical_title: "Caesar Assassination",
            event_text: "Julius Caesar falls at Theatre of Pompey",
            geo: "Rome",
            difficulty_guess: 5,
            confidence: 0.95,
            leak_flags: {
              has_digits: false,
              has_century_terms: false,
              has_spelled_year: false,
            },
          },
        ],
      };

      const mockClient = createMockClient(payload);
      await generateCandidatesForYear({
        year: -44,
        era: "BCE",
        llmClient: mockClient,
      });

      // Verify the prompt includes BCE-specific context
      const callArgs = (mockClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.user).toContain("Ancient world");
      expect(callArgs.user).toContain("Structure events around people");
      expect(callArgs.user).toContain("Caesar conquers");
    });

    it("adds ancient CE context for 1-2 digit years", async () => {
      const payload: GeneratorOutput = {
        year: { value: 64, era: "CE", digits: 2 },
        candidates: [
          {
            canonical_title: "Great Fire of Rome",
            event_text: "Emperor Nero oversees reconstruction after fire",
            geo: "Rome",
            difficulty_guess: 4,
            confidence: 0.9,
            leak_flags: {
              has_digits: false,
              has_century_terms: false,
              has_spelled_year: false,
            },
          },
        ],
      };

      const mockClient = createMockClient(payload);
      await generateCandidatesForYear({
        year: 64,
        era: "CE",
        llmClient: mockClient,
      });

      // Verify the prompt includes ancient CE context
      const callArgs = (mockClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.user).toContain("Early Roman Empire");
      expect(callArgs.user).toContain("emperors");
      expect(callArgs.user).toContain("dynasties");
    });

    it("adds early modern context for obscure years (1500-1700)", async () => {
      const payload: GeneratorOutput = {
        year: { value: 1588, era: "CE", digits: 4 },
        candidates: [
          {
            canonical_title: "Spanish Armada",
            event_text: "English fleet defeats Spanish invasion force",
            geo: "England",
            difficulty_guess: 4,
            confidence: 0.92,
            leak_flags: {
              has_digits: false,
              has_century_terms: false,
              has_spelled_year: false,
            },
          },
        ],
      };

      const mockClient = createMockClient(payload);
      await generateCandidatesForYear({
        year: 1588,
        era: "CE",
        llmClient: mockClient,
      });

      // Verify the prompt includes early modern context
      const callArgs = (mockClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.user).toContain("Early modern period");
      expect(callArgs.user).toContain("Renaissance");
      expect(callArgs.user).toContain("Reformation");
    });

    it("omits enhanced context for well-documented modern years", async () => {
      const payload: GeneratorOutput = {
        year: { value: 1969, era: "CE", digits: 4 },
        candidates: [
          {
            canonical_title: "Moon Landing",
            event_text: "Armstrong walks on lunar surface",
            geo: "Moon",
            difficulty_guess: 5,
            confidence: 0.99,
            leak_flags: {
              has_digits: false,
              has_century_terms: false,
              has_spelled_year: false,
            },
          },
        ],
      };

      const mockClient = createMockClient(payload);
      await generateCandidatesForYear({
        year: 1969,
        era: "CE",
        llmClient: mockClient,
      });

      // Verify no enhanced context for modern well-documented years
      const callArgs = (mockClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.user).not.toContain("Context:");
      expect(callArgs.user).not.toContain("Early Roman Empire");
      expect(callArgs.user).not.toContain("Early modern period");
    });

    it("adds Hellenistic period context for 300-30 BCE", async () => {
      const payload: GeneratorOutput = {
        year: { value: -146, era: "BCE", digits: 3 },
        candidates: [
          {
            canonical_title: "Corinth Destruction",
            event_text: "Roman consul razes city to ground",
            geo: "Greece",
            difficulty_guess: 2,
            confidence: 0.85,
            leak_flags: {
              has_digits: false,
              has_century_terms: false,
              has_spelled_year: false,
            },
          },
        ],
      };

      const mockClient = createMockClient(payload);
      await generateCandidatesForYear({
        year: -146,
        era: "BCE",
        llmClient: mockClient,
      });

      // Verify Hellenistic period context
      const callArgs = (mockClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.user).toContain("Hellenistic period");
      expect(callArgs.user).toContain("Ptolemies");
      expect(callArgs.user).toContain("Seleucids");
    });
  });
});
