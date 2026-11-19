import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { decidePuzzle, puzzleEditorRubric } from "./lib/puzzleEditor";

/**
 * Stage a complete two-mode horizon in one transaction. No partial calendar is
 * committed if even the last review is missing, rejected, stale or reused.
 * This is private: callers cannot manufacture publication approval.
 *
 * Rollout prerequisite: migrate existing future puzzles through the editor,
 * then wire the generation/ensure paths to this calendar. Until then, this
 * entry point is intentionally not invoked by the production cron.
 */
export const schedulePassedHorizon = internalMutation({
  args: {
    startDate: v.string(),
    days: v.array(
      v.object({
        classic: v.id("puzzleEditorReviews"),
        order: v.id("puzzleEditorReviews"),
      }),
    ),
  },
  handler: async (ctx, { startDate, days }) => {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !Number.isFinite(start.getTime()) ||
      start.toISOString().slice(0, 10) !== startDate
    ) {
      throw new Error("Invalid schedule start date");
    }
    if (days.length < 14 || days.length > 31) {
      throw new Error("A passed horizon must cover 14 to 31 consecutive days");
    }
    const seen = new Set<string>();
    const plan = [];
    for (const [offset, day] of days.entries()) {
      const date = new Date(start.getTime() + offset * 86400000).toISOString().slice(0, 10);
      for (const mode of ["classic", "order"] as const) {
        const id = day[mode];
        if (seen.has(id)) throw new Error("A review cannot fill multiple schedule slots");
        seen.add(id);
        const review = await ctx.db.get(id);
        if (
          !review ||
          review.draft.mode !== mode ||
          review.rubricVersion !== puzzleEditorRubric.version ||
          !review.passed ||
          !decidePuzzle(review.draft, review.scores).passed
        ) {
          throw new Error(`Missing current editor pass for ${date} ${mode}`);
        }
        if (review.scheduledDate && review.scheduledDate !== date) {
          throw new Error("Editor pass already scheduled for another date");
        }
        const table = mode === "classic" ? "puzzles" : "orderPuzzles";
        const existing = await ctx.db
          .query(table)
          .withIndex("by_date", (q) => q.eq("date", date))
          .unique();
        if (existing && existing.editorReviewId !== id) {
          throw new Error(`Existing ${mode} puzzle for ${date} requires editor migration`);
        }
        // Audit-link equality alone is insufficient if another writer changed clues.
        if (existing) {
          const expected = review.draft.clues;
          const matches =
            "targetYear" in existing
              ? existing.targetYear === expected[0].year &&
                existing.events.every((text, i) => text === expected[i]?.text)
              : existing.events.every(
                  (event, i) =>
                    event.text === expected[i]?.text && event.year === expected[i]?.year,
                );
          if (!matches || existing.events.length !== expected.length) {
            throw new Error("Scheduled puzzle differs from its editor pass");
          }
        }
        plan.push({ mode, date, review, existing });
      }
    }

    let classicNumber =
      (await ctx.db.query("puzzles").withIndex("by_number").order("desc").first())?.puzzleNumber ??
      0;
    let orderNumber =
      (await ctx.db.query("orderPuzzles").withIndex("by_number").order("desc").first())
        ?.puzzleNumber ?? 0;
    for (const { mode, date, review, existing } of plan) {
      if (existing) continue;
      const common = {
        date,
        editorReviewId: review._id,
        updatedAt: Date.now(),
      };
      if (mode === "classic") {
        await ctx.db.insert("puzzles", {
          ...common,
          puzzleNumber: ++classicNumber,
          targetYear: review.draft.clues[0].year,
          events: review.draft.clues.map((clue) => clue.text),
          playCount: 0,
          avgGuesses: 0,
        });
      } else {
        await ctx.db.insert("orderPuzzles", {
          ...common,
          puzzleNumber: ++orderNumber,
          seed: review._id,
          events: review.draft.clues.map((clue, index) => ({
            id: `${review._id}:${index}`,
            text: clue.text,
            year: clue.year,
          })),
        });
      }
      await ctx.db.patch(review._id, { scheduledDate: date });
    }
    return { days: days.length, slots: plan.length };
  },
});
