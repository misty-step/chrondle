import { describe, expect, it, vi } from "vitest";
import {
  decidePuzzle,
  editUntilPassed,
  PuzzleDraftSchema,
  type EditorScores,
  type PuzzleDraft,
} from "../puzzleEditor";

// Synthetic contract fixtures, not publishable historical claims or real editor evidence.
const draft = (): PuzzleDraft => ({
  mode: "classic",
  clues: Array.from({ length: 6 }, (_, i) => ({
    text: `A worker at Workshop ${String.fromCharCode(65 + i)} hides a tiny signature inside the finished machine`,
    year: 1901,
    sourceUrl: `https://example.org/archive/workshop-${i}`,
  })),
});
const scores = (): EditorScores => ({
  clues: Array.from({ length: 6 }, () => ({
    story: 0.9,
    sourceSupport: 0.9,
    noLeakage: 1,
    wayIn: 0.9,
    reasoning: "Synthetic assessment",
  })),
  predictedSolveRate: 0.45,
  difficultyReasoning: "Synthetic target estimate",
  revisionInstructions: [],
});

describe("versioned puzzle editor contract", () => {
  it("rejects a deliberately bad puzzle despite perfect model scores", () => {
    const bad = draft();
    bad.clues[0].text = "The factory opens in 1901 AD";
    const decision = decidePuzzle(bad, scores());
    expect(decision.passed).toBe(false);
    expect(decision.failures).toContain("clue 1: deterministic leakage");
    expect(decision.rubricVersion).toBe("puzzle-editor-v1");
  });

  it.each(["story", "sourceSupport", "noLeakage"] as const)(
    "requires every clue to pass %s",
    (criterion) => {
      const assessment = scores();
      assessment.clues[5][criterion] = 0.79;
      expect(decidePuzzle(draft(), assessment).passed).toBe(false);
    },
  );

  it("requires a recognizable way in", () => {
    const assessment = scores();
    assessment.clues.forEach((clue) => {
      clue.wayIn = 0.1;
    });
    expect(decidePuzzle(draft(), assessment).failures).toContain("no way in");
  });

  it.each([0.34, 0.56])("rejects Classic solve-rate estimate %s", (rate) => {
    const assessment = scores();
    assessment.predictedSolveRate = rate;
    expect(decidePuzzle(draft(), assessment).passed).toBe(false);
  });

  it("applies Order's target rather than Classic's", () => {
    const order = draft();
    order.mode = "order";
    order.clues.forEach((clue, i) => {
      clue.year += i;
    });
    expect(decidePuzzle(order, scores()).passed).toBe(false);
    const assessment = scores();
    assessment.predictedSolveRate = 0.85;
    expect(decidePuzzle(order, assessment).passed).toBe(true);
  });

  it.each(["", "ftp://example.org/source", "https://user:password@example.org/source"])(
    "rejects invalid source %s",
    (sourceUrl) => {
      const invalid = draft();
      invalid.clues[0].sourceUrl = sourceUrl;
      expect(() => decidePuzzle(invalid, scores())).toThrow();
    },
  );

  it("rejects missing or extra clue assessments", () => {
    const assessment = scores();
    assessment.clues.pop();
    expect(() => decidePuzzle(draft(), assessment)).toThrow();
  });

  it("rejects duplicate clues, mixed Classic years and year zero", () => {
    const invalid = draft();
    invalid.clues[0] = invalid.clues[1];
    expect(PuzzleDraftSchema.safeParse(invalid).success).toBe(false);
    invalid.clues[0] = { ...invalid.clues[0], text: "A distinct clue", year: 0 };
    expect(PuzzleDraftSchema.safeParse(invalid).success).toBe(false);
  });

  it("rechecks revisions and preserves before/after attempts", async () => {
    const editor = vi
      .fn()
      .mockImplementationOnce(async () => {
        const bad = scores();
        bad.clues[0].story = 0;
        return bad;
      })
      .mockImplementationOnce(async () => scores());
    const revise = vi.fn(async (original: PuzzleDraft) => ({
      ...original,
      clues: original.clues.map((clue, i) =>
        i
          ? clue
          : { ...clue, text: "An apprentice at Workshop A scratches her name beneath the machine" },
      ),
    }));
    const result = await editUntilPassed(draft(), editor, revise);
    expect(result.passed).toBe(true);
    expect(editor).toHaveBeenCalledTimes(2);
    expect(revise).toHaveBeenCalledTimes(1);
    expect(result.attempts[0].draft.clues[0].text).not.toEqual(
      result.attempts[1].draft.clues[0].text,
    );
  });

  it("exhausts bounded retries without returning a publishable puzzle", async () => {
    const assessment = scores();
    assessment.clues[0].sourceSupport = 0;
    const editor = vi.fn(async () => assessment);
    const revise = vi.fn(async (original: PuzzleDraft) => original);
    const result = await editUntilPassed(draft(), editor, revise);
    expect(result.passed).toBe(false);
    expect(result.attempts).toHaveLength(3);
    expect(revise).toHaveBeenCalledTimes(2);
  });

  it("propagates editor failure instead of approving an unchecked draft", async () => {
    const revise = vi.fn();
    await expect(
      editUntilPassed(
        draft(),
        async () => {
          throw new Error("Provider unavailable");
        },
        revise,
      ),
    ).rejects.toThrow("Provider unavailable");
    expect(revise).not.toHaveBeenCalled();
  });
});
