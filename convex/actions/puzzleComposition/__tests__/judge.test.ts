import { describe, it, expect, vi } from "vitest";
import type { Gemini3Client } from "../../../lib/gemini3Client";
import type { PuzzleJudgment } from "../schemas";
import { judgePuzzleComposition, validateJudgeInput } from "../judge";

const SAMPLE_EVENTS = [
  "Construction begins on the Great Library of Alexandria",
  "Battle of Gaugamela decides the fate of the Persian Empire",
  "Aristotle becomes tutor to young Alexander",
  "Philip II unifies the Greek city-states",
  "Olympic Games held at Olympia",
  "Alexander the Great conquers Egypt",
];

function mockJudgment(overrides: Partial<PuzzleJudgment> = {}): PuzzleJudgment {
  return {
    approved: true,
    qualityScore: 0.75,
    ordering: {
      recommended: SAMPLE_EVENTS,
      rationale: "Ordered from obscure library construction to famous Egyptian conquest",
    },
    composition: {
      topicDiversity: 0.7,
      geographicSpread: 0.6,
      difficultyGradient: 0.8,
      guessability: 0.9,
    },
    issues: [],
    suggestions: [],
    ...overrides,
  };
}

function createMockClient(judgment: PuzzleJudgment): Gemini3Client {
  return {
    generate: vi.fn().mockResolvedValue({
      data: judgment,
      rawText: JSON.stringify(judgment),
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        reasoningTokens: 200,
        totalTokens: 1700,
      },
      cost: {
        inputUsd: 0.01,
        outputUsd: 0.005,
        reasoningUsd: 0,
        cacheSavingsUsd: 0,
        totalUsd: 0.015,
      },
      metadata: {
        model: "google/gemini-3-flash-preview",
        latencyMs: 2000,
        cacheHit: false,
        requestId: "req_judge_test",
      },
    }),
  } as unknown as Gemini3Client;
}

describe("judgePuzzleComposition", () => {
  it("returns approved judgment when quality is high", async () => {
    const judgment = mockJudgment({ approved: true, qualityScore: 0.8 });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 334,
      era: "BCE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.approved).toBe(true);
    expect(result.judgment.qualityScore).toBeGreaterThanOrEqual(0.6);
    expect(result.llm.model).toBe("google/gemini-3-flash-preview");
  });

  it("overrides LLM approval when quality score is below threshold", async () => {
    // LLM says approved but scores don't meet threshold
    const judgment = mockJudgment({
      approved: true,
      qualityScore: 0.55, // Below 0.6 threshold
      composition: {
        topicDiversity: 0.5,
        geographicSpread: 0.5,
        difficultyGradient: 0.5,
        guessability: 0.5,
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 334,
      era: "BCE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.approved).toBe(false);
    // Check the actual issue message format: "Quality score 0.50 below 0.6 threshold"
    expect(result.judgment.issues.some((i) => i.includes("below 0.6 threshold"))).toBe(true);
  });

  it("overrides LLM approval when component score is below minimum", async () => {
    // LLM says approved but one component is too low
    const judgment = mockJudgment({
      approved: true,
      qualityScore: 0.7,
      composition: {
        topicDiversity: 0.3, // Below 0.4 minimum
        geographicSpread: 0.7,
        difficultyGradient: 0.8,
        guessability: 0.9,
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 334,
      era: "BCE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.approved).toBe(false);
    // Check the actual issue message format: "Low scores: topicDiversity"
    expect(result.judgment.issues).toContain("Low scores: topicDiversity");
  });

  it("recomputes quality score from weighted components", async () => {
    // Weights: topicDiversity: 0.2, geographicSpread: 0.2, difficultyGradient: 0.3, guessability: 0.3
    // Expected: 0.8*0.2 + 0.6*0.2 + 0.9*0.3 + 1.0*0.3 = 0.16 + 0.12 + 0.27 + 0.3 = 0.85
    const judgment = mockJudgment({
      approved: true,
      qualityScore: 0.5, // LLM gives wrong score, should be recomputed
      composition: {
        topicDiversity: 0.8,
        geographicSpread: 0.6,
        difficultyGradient: 0.9,
        guessability: 1.0,
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 1969,
      era: "CE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.qualityScore).toBeCloseTo(0.85, 2);
    expect(result.judgment.approved).toBe(true); // 0.85 > 0.6
  });

  it("returns ordered events from LLM", async () => {
    const orderedEvents = [
      "Aristotle becomes tutor to young Alexander", // Most obscure
      "Construction begins on the Great Library of Alexandria",
      "Philip II unifies the Greek city-states",
      "Battle of Gaugamela decides the fate of the Persian Empire",
      "Olympic Games held at Olympia",
      "Alexander the Great conquers Egypt", // Most famous
    ];

    const judgment = mockJudgment({
      ordering: {
        recommended: orderedEvents,
        rationale: "Ordered Hard to Easy",
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 334,
      era: "BCE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.ordering.recommended).toEqual(orderedEvents);
    expect(result.judgment.ordering.recommended).toHaveLength(6);
  });

  it("throws error when fewer than 6 events provided", async () => {
    const client = createMockClient(mockJudgment());

    await expect(
      judgePuzzleComposition({
        year: 1969,
        era: "CE",
        events: ["Event 1", "Event 2", "Event 3"],
        llmClient: client,
      }),
    ).rejects.toThrow("Need at least 6 events");
  });

  it("tracks LLM usage and cost", async () => {
    const judgment = mockJudgment();
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 1969,
      era: "CE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.llm.usage.totalTokens).toBe(1700);
    expect(result.llm.costUsd).toBe(0.015);
    expect(result.llm.requestId).toBe("req_judge_test");
  });
});

describe("validateJudgeInput", () => {
  it("accepts valid input", () => {
    expect(() =>
      validateJudgeInput({
        year: 1969,
        era: "CE",
        events: SAMPLE_EVENTS,
      }),
    ).not.toThrow();
  });

  it("rejects fewer than 6 events", () => {
    expect(() =>
      validateJudgeInput({
        year: 1969,
        era: "CE",
        events: ["One", "Two", "Three"],
      }),
    ).toThrow("Need at least 6 events");
  });

  it("rejects invalid era", () => {
    expect(() =>
      validateJudgeInput({
        year: 1969,
        era: "AD" as "BCE" | "CE",
        events: SAMPLE_EVENTS,
      }),
    ).toThrow("Invalid era");
  });
});

describe("threshold enforcement edge cases", () => {
  it("passes puzzle exactly at 0.6 threshold", async () => {
    // Component scores that give exactly 0.6: 0.6*0.2 + 0.6*0.2 + 0.6*0.3 + 0.6*0.3 = 0.6
    const judgment = mockJudgment({
      approved: true,
      composition: {
        topicDiversity: 0.6,
        geographicSpread: 0.6,
        difficultyGradient: 0.6,
        guessability: 0.6,
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 1969,
      era: "CE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.approved).toBe(true);
    expect(result.judgment.qualityScore).toBeCloseTo(0.6, 2);
  });

  it("fails puzzle exactly at 0.4 component threshold", async () => {
    const judgment = mockJudgment({
      approved: true,
      composition: {
        topicDiversity: 0.39, // Just below 0.4
        geographicSpread: 0.8,
        difficultyGradient: 0.8,
        guessability: 0.8,
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 1969,
      era: "CE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.approved).toBe(false);
  });

  it("passes puzzle at exactly 0.4 component threshold", async () => {
    const judgment = mockJudgment({
      approved: true,
      composition: {
        topicDiversity: 0.4, // Exactly at threshold
        geographicSpread: 0.8,
        difficultyGradient: 0.8,
        guessability: 0.8,
      },
    });
    const client = createMockClient(judgment);

    const result = await judgePuzzleComposition({
      year: 1969,
      era: "CE",
      events: SAMPLE_EVENTS,
      llmClient: client,
    });

    expect(result.judgment.approved).toBe(true);
  });
});
