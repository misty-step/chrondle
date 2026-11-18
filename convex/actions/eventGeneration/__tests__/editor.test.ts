import { describe, expect, it, vi } from "vitest";
import type { Gemini3Client } from "../../../lib/gemini3Client";
import { reviewPuzzle } from "../editor";
import type { PuzzleDraft } from "../../../lib/puzzleEditor";

const draft: PuzzleDraft = {
  mode: "classic",
  clues: Array.from({ length: 6 }, (_, i) => ({
    text: `Workshop ${String.fromCharCode(65 + i)} opens its doors`,
    year: 1901,
    sourceUrl: "https://example.org/source",
  })),
};

describe("independent editor adapter", () => {
  it("uses its own rubric call and returns cost/usage with the exact draft", async () => {
    const generate = vi.fn(async () => ({
      data: {
        clues: Array.from({ length: 6 }, () => ({
          story: 0,
          sourceSupport: 0,
          noLeakage: 1,
          wayIn: 0,
          reasoning: "Dry chronicle; supporting source not established",
        })),
        predictedSolveRate: 0.45,
        difficultyReasoning: "No recognizable entry point",
        revisionInstructions: ["Find sourced human details"],
      },
      usage: { inputTokens: 100, outputTokens: 100, reasoningTokens: 0, totalTokens: 200 },
      cost: { totalUsd: 0.01 },
      metadata: { model: "test-editor" },
    }));
    const result = await reviewPuzzle(draft, { generate } as unknown as Gemini3Client);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]).toBeDefined();
    expect(result.decision.passed).toBe(false);
    expect(result.draft).toEqual(draft);
    expect(result.cost.totalUsd).toBe(0.01);
    expect(result.model).toBe("test-editor");
  });

  it("validates before charging for an editor call", async () => {
    const generate = vi.fn();
    await expect(
      reviewPuzzle({ ...draft, clues: [] }, { generate } as unknown as Gemini3Client),
    ).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not turn a provider outage into a pass", async () => {
    const generate = vi.fn(async () => {
      throw new Error("Unavailable");
    });
    await expect(reviewPuzzle(draft, { generate } as unknown as Gemini3Client)).rejects.toThrow(
      "Unavailable",
    );
  });
});
