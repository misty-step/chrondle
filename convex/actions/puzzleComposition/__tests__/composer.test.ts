import { describe, it, expect, vi, beforeEach } from "vitest";
import { composePuzzleWithJudge, composePuzzleWithRetries, legacyShuffleEvents } from "../composer";
import * as judgeModule from "../judge";

const SAMPLE_EVENTS = [
  "First event about ancient history",
  "Second event about medieval times",
  "Third event about Renaissance",
  "Fourth event about Industrial Revolution",
  "Fifth event about World War",
  "Sixth event about Space Age",
];

const mockApprovedJudgment = {
  approved: true,
  qualityScore: 0.8,
  ordering: {
    recommended: [...SAMPLE_EVENTS].reverse(), // Reversed as "Hard to Easy"
    rationale: "Ordered from obscure to famous",
  },
  composition: {
    topicDiversity: 0.8,
    geographicSpread: 0.7,
    difficultyGradient: 0.85,
    guessability: 0.9,
  },
  issues: [],
  suggestions: [],
};

const mockRejectedJudgment = {
  approved: false,
  qualityScore: 0.45,
  ordering: {
    recommended: SAMPLE_EVENTS,
    rationale: "Poor quality puzzle",
  },
  composition: {
    topicDiversity: 0.3,
    geographicSpread: 0.4,
    difficultyGradient: 0.5,
    guessability: 0.6,
  },
  issues: ["Too narrow topic focus", "Geographic concentration"],
  suggestions: ["Add events from different regions"],
};

describe("composePuzzleWithJudge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success with ordered events when approved", async () => {
    vi.spyOn(judgeModule, "judgePuzzleComposition").mockResolvedValue({
      judgment: mockApprovedJudgment,
      llm: {
        requestId: "test-req",
        model: "google/gemini-3-flash-preview",
        usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
        costUsd: 0.01,
        cacheHit: false,
      },
    });

    const result = await composePuzzleWithJudge({
      year: 1969,
      events: SAMPLE_EVENTS,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.orderedEvents).toEqual([...SAMPLE_EVENTS].reverse());
      expect(result.judgment.qualityScore).toBe(0.8);
      expect(result.attempts).toBe(1);
    }
  });

  it("returns failed with reason when rejected", async () => {
    vi.spyOn(judgeModule, "judgePuzzleComposition").mockResolvedValue({
      judgment: mockRejectedJudgment,
      llm: {
        requestId: "test-req",
        model: "google/gemini-3-flash-preview",
        usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
        costUsd: 0.01,
        cacheHit: false,
      },
    });

    const result = await composePuzzleWithJudge({
      year: 1969,
      events: SAMPLE_EVENTS,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("Too narrow topic focus");
      expect(result.lastJudgment?.qualityScore).toBe(0.45);
    }
  });

  it("returns failed when fewer than 6 events provided", async () => {
    const result = await composePuzzleWithJudge({
      year: 1969,
      events: ["One", "Two", "Three"],
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("Need at least 6 events");
      expect(result.attempts).toBe(0);
    }
  });

  it("returns failed on LLM error", async () => {
    vi.spyOn(judgeModule, "judgePuzzleComposition").mockRejectedValue(
      new Error("LLM service unavailable"),
    );

    const result = await composePuzzleWithJudge({
      year: 1969,
      events: SAMPLE_EVENTS,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toBe("LLM service unavailable");
    }
  });

  it("handles BCE years correctly", async () => {
    const spyJudge = vi.spyOn(judgeModule, "judgePuzzleComposition").mockResolvedValue({
      judgment: mockApprovedJudgment,
      llm: {
        requestId: "test-req",
        model: "google/gemini-3-flash-preview",
        usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
        costUsd: 0.01,
        cacheHit: false,
      },
    });

    await composePuzzleWithJudge({
      year: -334, // 334 BCE
      events: SAMPLE_EVENTS,
    });

    expect(spyJudge).toHaveBeenCalledWith(
      expect.objectContaining({
        year: 334, // Absolute value
        era: "BCE",
      }),
    );
  });
});

describe("composePuzzleWithRetries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("succeeds on first attempt", async () => {
    vi.spyOn(judgeModule, "judgePuzzleComposition").mockResolvedValue({
      judgment: mockApprovedJudgment,
      llm: {
        requestId: "test-req",
        model: "google/gemini-3-flash-preview",
        usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
        costUsd: 0.01,
        cacheHit: false,
      },
    });

    let callCount = 0;
    const getYearCandidates = async () => {
      callCount++;
      return { year: 1969, events: SAMPLE_EVENTS };
    };

    const result = await composePuzzleWithRetries(getYearCandidates, 3);

    expect(result.status).toBe("success");
    expect(result.attemptedYears).toEqual([1969]);
    expect(callCount).toBe(1);
  });

  it("retries different years until success", async () => {
    const mockJudge = vi.spyOn(judgeModule, "judgePuzzleComposition");

    // First two attempts fail, third succeeds
    mockJudge
      .mockResolvedValueOnce({
        judgment: mockRejectedJudgment,
        llm: {
          requestId: "req-1",
          model: "google/gemini-3-flash-preview",
          usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
          costUsd: 0.01,
          cacheHit: false,
        },
      })
      .mockResolvedValueOnce({
        judgment: mockRejectedJudgment,
        llm: {
          requestId: "req-2",
          model: "google/gemini-3-flash-preview",
          usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
          costUsd: 0.01,
          cacheHit: false,
        },
      })
      .mockResolvedValueOnce({
        judgment: mockApprovedJudgment,
        llm: {
          requestId: "req-3",
          model: "google/gemini-3-flash-preview",
          usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
          costUsd: 0.01,
          cacheHit: false,
        },
      });

    const years = [1969, 1989, 2001];
    let index = 0;
    const getYearCandidates = async () => {
      const year = years[index++];
      return { year, events: SAMPLE_EVENTS };
    };

    const result = await composePuzzleWithRetries(getYearCandidates, 3);

    expect(result.status).toBe("success");
    expect(result.attemptedYears).toEqual([1969, 1989, 2001]);
    expect(result.attempts).toBe(3);
  });

  it("fails after max attempts exhausted", async () => {
    vi.spyOn(judgeModule, "judgePuzzleComposition").mockResolvedValue({
      judgment: mockRejectedJudgment,
      llm: {
        requestId: "test-req",
        model: "google/gemini-3-flash-preview",
        usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
        costUsd: 0.01,
        cacheHit: false,
      },
    });

    const years = [1969, 1989, 2001];
    let index = 0;
    const getYearCandidates = async () => {
      const year = years[index++];
      return { year, events: SAMPLE_EVENTS };
    };

    const result = await composePuzzleWithRetries(getYearCandidates, 3);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("All 3 attempts failed");
      expect(result.lastJudgment).toEqual(mockRejectedJudgment);
    }
    expect(result.attemptedYears).toEqual([1969, 1989, 2001]);
  });

  it("fails when no more candidates available", async () => {
    const getYearCandidates = async () => null; // No candidates

    const result = await composePuzzleWithRetries(getYearCandidates, 3);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.reason).toContain("No more year candidates");
    }
    expect(result.attemptedYears).toEqual([]);
  });
});

describe("legacyShuffleEvents", () => {
  it("returns exactly 6 events", () => {
    const events = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const shuffled = legacyShuffleEvents(events);

    expect(shuffled).toHaveLength(6);
  });

  it("contains only events from input", () => {
    const events = SAMPLE_EVENTS;
    const shuffled = legacyShuffleEvents(events);

    shuffled.forEach((event) => {
      expect(events).toContain(event);
    });
  });

  it("does not modify original array", () => {
    const events = [...SAMPLE_EVENTS];
    const originalOrder = [...events];
    legacyShuffleEvents(events);

    expect(events).toEqual(originalOrder);
  });

  it("produces different orderings (statistical)", () => {
    const events = SAMPLE_EVENTS;
    const results = new Set<string>();

    // Run 20 shuffles, should get multiple unique orderings
    for (let i = 0; i < 20; i++) {
      results.add(legacyShuffleEvents(events).join("|"));
    }

    // With 6! = 720 permutations, 20 runs should rarely all be identical
    expect(results.size).toBeGreaterThan(1);
  });
});
