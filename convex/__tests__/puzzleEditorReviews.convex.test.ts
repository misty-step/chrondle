import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

const payload = () => ({
  draft: {
    mode: "classic",
    clues: Array.from({ length: 6 }, (_, i) => ({
      text: `A worker at Workshop ${String.fromCharCode(65 + i)} leaves her signature beneath the machine`,
      year: 1901,
      sourceUrl: `https://example.org/source-${i}`,
    })),
  },
  scores: {
    clues: Array.from({ length: 6 }, () => ({
      story: 0.9,
      sourceSupport: 0.9,
      noLeakage: 1,
      wayIn: 0.9,
      reasoning: "Synthetic assessment",
    })),
    predictedSolveRate: 0.45,
    difficultyReasoning: "Synthetic estimate",
    revisionInstructions: [],
  },
  model: "test-editor",
  costUsd: 0.01,
  totalTokens: 200,
});

describe("private editor review records", () => {
  it("stores exact clue/source order and rubric-bound assessment, not a puzzle", async () => {
    const t = convexTest(schema, modules);
    const input = payload();
    const id = await t.mutation(anyApi.puzzleEditorReviews.recordReview, input);
    await t.run(async (ctx) => {
      const record = await ctx.db.get(id);
      expect(record).toMatchObject({
        draft: input.draft,
        rubricVersion: "puzzle-editor-v1",
        passed: true,
      });
      expect(await ctx.db.query("puzzles").collect()).toEqual([]);
      expect(await ctx.db.query("orderPuzzles").collect()).toEqual([]);
    });
  });

  it("records rejection and a later pass separately without overwriting evidence", async () => {
    const t = convexTest(schema, modules);
    const bad = payload();
    bad.draft.clues[0].text = "The factory opens in 1901 AD";
    await t.mutation(anyApi.puzzleEditorReviews.recordReview, bad);
    await t.mutation(anyApi.puzzleEditorReviews.recordReview, payload());
    await t.run(async (ctx) => {
      const records = await ctx.db.query("puzzleEditorReviews").collect();
      expect(records).toHaveLength(2);
      expect(records.map((record) => record.passed)).toEqual([false, true]);
      expect(records[0].failures).toContain("clue 1: deterministic leakage");
    });
  });

  it("does not record malformed drafts or invalid accounting", async () => {
    const t = convexTest(schema, modules);
    const bad = payload();
    bad.draft.clues[0].sourceUrl = "not a URL";
    await expect(t.mutation(anyApi.puzzleEditorReviews.recordReview, bad)).rejects.toThrow();
    await expect(
      t.mutation(anyApi.puzzleEditorReviews.recordReview, { ...payload(), costUsd: -1 }),
    ).rejects.toThrow("Invalid editor accounting");
    expect(await t.run((ctx) => ctx.db.query("puzzleEditorReviews").collect())).toEqual([]);
  });
});
