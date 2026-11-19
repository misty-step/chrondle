import { convexTest } from "convex-test";
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";

function review(mode: "classic" | "order", bad = false) {
  return {
    draft: {
      mode,
      clues: Array.from({ length: 6 }, (_, i) => ({
        text:
          bad && i === 0
            ? "The factory opens in 1901 AD"
            : `A worker at Workshop ${String.fromCharCode(65 + i)} leaves her signature beneath the machine`,
        year: mode === "classic" ? 1901 : 1701 + i * 50,
        sourceUrl: `https://example.org/source-${i}`,
      })),
    },
    scores: {
      clues: Array.from({ length: 6 }, () => ({
        story: 0.9,
        sourceSupport: 0.9,
        noLeakage: 1,
        wayIn: 0.9,
        reasoning: "Synthetic assessment, not live source evidence",
      })),
      predictedSolveRate: mode === "classic" ? 0.45 : 0.9,
      difficultyReasoning: "Synthetic estimate",
      revisionInstructions: [],
    },
    model: "test-editor",
    costUsd: 0,
    totalTokens: 0,
  };
}

async function fixture(badLast = false) {
  const t = convexTest(schema, modules);
  const days = [];
  for (let i = 0; i < 14; i++) {
    days.push({
      classic: await t.mutation(anyApi.puzzleEditorReviews.recordReview, review("classic")),
      order: await t.mutation(
        anyApi.puzzleEditorReviews.recordReview,
        review("order", badLast && i === 13),
      ),
    });
  }
  return { t, days };
}

describe("private atomic passed horizon", () => {
  it("schedules 14 consecutive days in both modes, preserving exact approved clues and sources", async () => {
    const { t, days } = await fixture();
    const args = { startDate: "2026-12-01", days };
    expect(await t.mutation(anyApi.editorSchedule.schedulePassedHorizon, args)).toEqual({
      days: 14,
      slots: 28,
    });
    // Retry is idempotent, not another consumption of the buffer.
    await t.mutation(anyApi.editorSchedule.schedulePassedHorizon, args);
    await t.run(async (ctx) => {
      const classic = await ctx.db.query("puzzles").withIndex("by_date").collect();
      const order = await ctx.db.query("orderPuzzles").withIndex("by_date").collect();
      expect(classic).toHaveLength(14);
      expect(order).toHaveLength(14);
      expect(classic.map((p) => p.date)).toEqual(order.map((p) => p.date));
      expect(classic[13].date).toBe("2026-12-14");
      for (const p of classic) {
        const record = await ctx.db.get(p.editorReviewId!);
        expect(record?.passed).toBe(true);
        expect(record?.scheduledDate).toBe(p.date);
        expect(record?.draft.clues.map((c) => c.text)).toEqual(p.events);
        expect(record?.draft.clues.every((c) => c.sourceUrl.startsWith("https://"))).toBe(true);
        // Keep source URLs private; they often contain the answer year.
        expect(p).not.toHaveProperty("sourceUrls");
      }
    });
  });

  it("rejects a deliberately bad final fixture despite passing model scores, with no partial calendar", async () => {
    const { t, days } = await fixture(true);
    await expect(
      t.mutation(anyApi.editorSchedule.schedulePassedHorizon, { startDate: "2026-12-01", days }),
    ).rejects.toThrow("Missing current editor pass");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("puzzles").collect()).toEqual([]);
      expect(await ctx.db.query("orderPuzzles").collect()).toEqual([]);
      expect(
        (await ctx.db.query("puzzleEditorReviews").collect()).every((r) => !r.scheduledDate),
      ).toBe(true);
    });
  });

  it("rejects insufficient coverage, repeated reviews, swapped modes and invalid dates", async () => {
    const { t, days } = await fixture();
    for (const [startDate, input, error] of [
      ["2026-12-01", days.slice(1), "14 to 31"],
      ["2026-12-01", [days[0], ...days.slice(0, 13)], "multiple schedule slots"],
      [
        "2026-12-01",
        days.map((d) => ({ classic: d.order, order: d.classic })),
        "Missing current editor pass",
      ],
      ["2026-02-30", days, "Invalid schedule start date"],
    ] as const) {
      await expect(
        t.mutation(anyApi.editorSchedule.schedulePassedHorizon, { startDate, days: input }),
      ).rejects.toThrow(error);
    }
  });

  it("cannot overwrite an existing unreviewed day or reuse a consumed pass", async () => {
    const { t, days } = await fixture();
    const id = await t.run((ctx) =>
      ctx.db.insert("puzzles", {
        date: "2026-12-14",
        puzzleNumber: 1,
        targetYear: 1901,
        events: ["Unreviewed"],
        playCount: 0,
        avgGuesses: 0,
        updatedAt: 0,
      }),
    );
    await expect(
      t.mutation(anyApi.editorSchedule.schedulePassedHorizon, {
        startDate: "2026-12-01",
        days,
      }),
    ).rejects.toThrow("requires editor migration");
    expect(await t.run((ctx) => ctx.db.query("puzzles").collect())).toHaveLength(1);
    await t.run((ctx) => ctx.db.delete(id));
    await t.mutation(anyApi.editorSchedule.schedulePassedHorizon, {
      startDate: "2026-12-01",
      days,
    });
    await expect(
      t.mutation(anyApi.editorSchedule.schedulePassedHorizon, {
        startDate: "2027-01-01",
        days,
      }),
    ).rejects.toThrow("already scheduled");
  });

  it("prevents the asynchronous composition optimizer from invalidating an approval", async () => {
    const { t, days } = await fixture();
    await t.mutation(anyApi.editorSchedule.schedulePassedHorizon, {
      startDate: "2026-12-01",
      days,
    });
    const puzzle = await t.run((ctx) => ctx.db.query("puzzles").first());
    await expect(
      t.mutation(anyApi.puzzles.mutations.updatePuzzleEvents, {
        puzzleId: puzzle!._id,
        events: ["Unreviewed replacement"],
        puzzleQuality: {
          qualityScore: 1,
          composition: {
            topicDiversity: 1,
            geographicSpread: 1,
            difficultyGradient: 1,
            guessability: 1,
          },
          judgedAt: 0,
        },
      }),
    ).rejects.toThrow("cannot change without a new editor pass");
    expect((await t.run((ctx) => ctx.db.get(puzzle!._id)))?.events).toEqual(puzzle!.events);
  });

  it("detects changes to a linked puzzle instead of treating it as approved", async () => {
    const { t, days } = await fixture();
    const args = { startDate: "2026-12-01", days };
    await t.mutation(anyApi.editorSchedule.schedulePassedHorizon, args);
    await t.run(async (ctx) => {
      const puzzle = await ctx.db.query("puzzles").first();
      await ctx.db.patch(puzzle!._id, { events: ["Changed after review"] });
    });
    await expect(t.mutation(anyApi.editorSchedule.schedulePassedHorizon, args)).rejects.toThrow(
      "differs from its editor pass",
    );
  });
});
