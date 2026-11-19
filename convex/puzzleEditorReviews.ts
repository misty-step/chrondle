import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { decidePuzzle, PuzzleDraftSchema, EditorScoresSchema } from "./lib/puzzleEditor";

/** Append-only private audit record. Publication integration is not enabled yet. */
export const recordReview = internalMutation({
  args: {
    draft: v.any(),
    scores: v.any(),
    model: v.string(),
    costUsd: v.number(),
    totalTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const draft = PuzzleDraftSchema.parse(args.draft);
    const scores = EditorScoresSchema.parse(args.scores);
    if (
      !args.model.trim() ||
      !Number.isFinite(args.costUsd) ||
      args.costUsd < 0 ||
      !Number.isSafeInteger(args.totalTokens) ||
      args.totalTokens < 0
    ) {
      throw new Error("Invalid editor accounting");
    }
    // Recompute, rather than accepting a caller-supplied approval boolean/version.
    const decision = decidePuzzle(draft, scores);
    return ctx.db.insert("puzzleEditorReviews", {
      draft,
      ...decision,
      model: args.model,
      costUsd: args.costUsd,
      totalTokens: args.totalTokens,
      reviewedAt: Date.now(),
    });
  },
});
