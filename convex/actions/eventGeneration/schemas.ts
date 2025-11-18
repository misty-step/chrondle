"use node";

import { z } from "zod";

export const EraSchema = z.enum(["BCE", "CE"]);
export type Era = z.infer<typeof EraSchema>;

export const CandidateEventSchema = z.object({
  canonical_title: z.string().min(3),
  event_text: z.string().min(3).max(200), // ≤20 words ~= ≤200 chars
  geo: z.string().min(2),
  difficulty_guess: z.number().min(1).max(5),
  confidence: z.number().min(0).max(1),
  leak_flags: z.object({
    has_digits: z.boolean(),
    has_century_terms: z.boolean(),
    has_spelled_year: z.boolean(),
  }),
});

export const GeneratorOutputSchema = z.object({
  year: z.object({
    value: z.number(),
    era: EraSchema,
    digits: z.number().min(1).max(4),
  }),
  candidates: z.array(CandidateEventSchema).min(12).max(18),
});

export type CandidateEvent = z.infer<typeof CandidateEventSchema>;
export type GeneratorOutput = z.infer<typeof GeneratorOutputSchema>;

export const CritiqueScoreSchema = z.object({
  factual: z.number().min(0).max(1),
  leak_risk: z.number().min(0).max(1),
  ambiguity: z.number().min(0).max(1),
  guessability: z.number().min(0).max(1),
  diversity: z.number().min(0).max(1),
});

export const CritiqueResultSchema = z.object({
  event: CandidateEventSchema,
  passed: z.boolean(),
  scores: CritiqueScoreSchema,
  issues: z.array(z.string()),
  rewrite_hints: z.array(z.string()),
});

export type CritiqueResult = z.infer<typeof CritiqueResultSchema>;

export function parseEra(value: string): Era {
  const normalized = value.trim().toUpperCase();
  return EraSchema.parse(normalized);
}
