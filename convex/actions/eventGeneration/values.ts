"use node";

import { v } from "convex/values";

export const CandidateEventValue = v.object({
  canonical_title: v.string(),
  event_text: v.string(),
  geo: v.string(),
  difficulty_guess: v.number(),
  confidence: v.number(),
  leak_flags: v.object({
    has_digits: v.boolean(),
    has_century_terms: v.boolean(),
    has_spelled_year: v.boolean(),
  }),
  metadata: v.optional(
    v.object({
      difficulty: v.optional(v.number()),
      category: v.optional(v.array(v.string())),
      era: v.optional(v.string()),
      fame_level: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    }),
  ),
});
