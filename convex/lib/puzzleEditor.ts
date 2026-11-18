import { z } from "zod";
import rubric from "../../docs/rubrics/puzzle-editor-v1.json";
import { hasLeakage } from "./eventValidation";

export { rubric as puzzleEditorRubric };

const SourceUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "A source must be an HTTP(S) URL without credentials");

export const PuzzleDraftSchema = z
  .object({
    mode: z.enum(["classic", "order"]),
    clues: z
      .array(
        z.object({
          text: z.string().min(3).max(200),
          year: z
            .number()
            .int()
            .refine((year) => year !== 0, "No year zero"),
          sourceUrl: SourceUrl,
        }),
      )
      .length(rubric.clueCount),
  })
  .superRefine((draft, ctx) => {
    const years = new Set(draft.clues.map((clue) => clue.year));
    if (draft.mode === "classic" && years.size !== 1) {
      ctx.addIssue({ code: "custom", message: "Classic clues must share a year" });
    }
    if (draft.mode === "order" && years.size !== draft.clues.length) {
      ctx.addIssue({ code: "custom", message: "Order clues must have distinct years" });
    }
    if (
      new Set(draft.clues.map((clue) => clue.text.trim().toLowerCase())).size !== draft.clues.length
    ) {
      ctx.addIssue({ code: "custom", message: "Duplicate clues" });
    }
  });

const score = z.number().min(0).max(1);
export const EditorScoresSchema = z.object({
  clues: z
    .array(
      z.object({
        story: score,
        sourceSupport: score,
        noLeakage: score,
        wayIn: score,
        reasoning: z.string().min(1),
      }),
    )
    .length(rubric.clueCount),
  predictedSolveRate: score,
  difficultyReasoning: z.string().min(1),
  revisionInstructions: z.array(z.string()),
});

export type PuzzleDraft = z.infer<typeof PuzzleDraftSchema>;
export type EditorScores = z.infer<typeof EditorScoresSchema>;
export type EditorDecision = ReturnType<typeof decidePuzzle>;

/** Fail closed: the model supplies scores, never publication authority. */
export function decidePuzzle(input: PuzzleDraft, assessment: EditorScores) {
  const draft = PuzzleDraftSchema.parse(input);
  const scores = EditorScoresSchema.parse(assessment);
  const failures: string[] = [];
  scores.clues.forEach((clue, index) => {
    for (const criterion of ["story", "sourceSupport", "noLeakage"] as const) {
      if (clue[criterion] < rubric.minimumScore) failures.push(`clue ${index + 1}: ${criterion}`);
    }
    if (hasLeakage(draft.clues[index].text))
      failures.push(`clue ${index + 1}: deterministic leakage`);
  });
  if (!scores.clues.some((clue) => clue.wayIn >= rubric.minimumScore)) failures.push("no way in");
  const target = rubric.solveRateTargets[draft.mode];
  if (scores.predictedSolveRate < target.minimum || scores.predictedSolveRate > target.maximum) {
    failures.push("difficulty outside mode target");
  }
  return {
    rubricVersion: rubric.version,
    passed: failures.length === 0,
    failures,
    scores,
  };
}

export interface EditorAttempt {
  draft: PuzzleDraft;
  decision: EditorDecision;
}

/** Revision is always independently rechecked; exhausted attempts never return a puzzle. */
export async function editUntilPassed(
  initial: PuzzleDraft,
  editor: (draft: PuzzleDraft) => Promise<EditorScores>,
  revise: (draft: PuzzleDraft, decision: EditorDecision) => Promise<PuzzleDraft>,
): Promise<{ passed: boolean; attempts: EditorAttempt[] }> {
  let draft = PuzzleDraftSchema.parse(initial);
  const attempts: EditorAttempt[] = [];
  for (let attempt = 0; attempt < rubric.maxAttempts; attempt++) {
    const decision = decidePuzzle(draft, await editor(structuredClone(draft)));
    attempts.push(structuredClone({ draft, decision }));
    if (decision.passed) return { passed: true, attempts };
    if (attempt + 1 < rubric.maxAttempts)
      draft = PuzzleDraftSchema.parse(await revise(draft, decision));
  }
  return { passed: false, attempts };
}
