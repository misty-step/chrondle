"use node";

import { z } from "zod";

/**
 * Composition scores evaluate puzzle quality as a whole
 */
export const CompositionScoresSchema = z.object({
  topicDiversity: z.number().min(0).max(1),
  geographicSpread: z.number().min(0).max(1),
  difficultyGradient: z.number().min(0).max(1),
  guessability: z.number().min(0).max(1),
});

export type CompositionScores = z.infer<typeof CompositionScoresSchema>;

/**
 * Ordering recommendation with rationale
 */
export const OrderingRecommendationSchema = z.object({
  recommended: z.array(z.string()).min(6).max(6),
  rationale: z.string(),
});

export type OrderingRecommendation = z.infer<typeof OrderingRecommendationSchema>;

/**
 * Full puzzle judgment from the Judge LLM
 */
export const PuzzleJudgmentSchema = z.object({
  approved: z.boolean(),
  qualityScore: z.number().min(0).max(1),
  ordering: OrderingRecommendationSchema,
  composition: CompositionScoresSchema,
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export type PuzzleJudgment = z.infer<typeof PuzzleJudgmentSchema>;

/**
 * Input to the Puzzle Judge
 */
export const PuzzleJudgeInputSchema = z.object({
  year: z.number(),
  era: z.enum(["BCE", "CE"]),
  events: z.array(z.string()).min(6),
});

export type PuzzleJudgeInput = z.infer<typeof PuzzleJudgeInputSchema>;

/**
 * Composer result after orchestration
 */
export const ComposerResultSchema = z.object({
  status: z.enum(["success", "failed"]),
  orderedEvents: z.array(z.string()).optional(),
  judgment: PuzzleJudgmentSchema.optional(),
  attempts: z.number(),
  reason: z.string().optional(),
});

export type ComposerResult = z.infer<typeof ComposerResultSchema>;
