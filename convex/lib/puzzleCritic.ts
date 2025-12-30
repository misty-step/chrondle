"use node";

import { z } from "zod";
import { createGemini3Client, type Gemini3Client, type TokenUsage } from "./gemini3Client";

/**
 * Puzzle Critic - Deep Module
 *
 * Evaluates a set of 6 puzzle hints for quality as a cohesive unit.
 * Checks for redundancy, vagueness, diversity, and overall puzzle quality.
 *
 * Design Principles (Ousterhout):
 * - Simple interface: critiquePuzzle(hints, year) → PuzzleQuality
 * - LLM does the semantic analysis, code just orchestrates
 * - No complex score blending or multi-layer validation
 */

export interface PuzzleQuality {
  passed: boolean;
  overallScore: number; // 0-1
  issues: PuzzleIssue[];
  suggestions: string[];
}

export interface PuzzleIssue {
  type: "redundancy" | "vagueness" | "diversity" | "difficulty";
  hintIndex: number;
  description: string;
}

export interface CritiqueResult {
  quality: PuzzleQuality;
  usage: TokenUsage;
  costUsd: number;
  model: string;
}

const PuzzleIssueSchema = z.object({
  type: z.enum(["redundancy", "vagueness", "diversity", "difficulty"]),
  hintIndex: z.number().min(0).max(5),
  description: z.string().max(100),
});

const PuzzleQualitySchema = z.object({
  passed: z.boolean(),
  overallScore: z.number().min(0).max(1),
  issues: z.array(PuzzleIssueSchema).max(6),
  suggestions: z.array(z.string().max(100)).max(3),
});

const SYSTEM_PROMPT = `You are a puzzle quality critic evaluating hint sets for a year-guessing game.

Evaluate these 6 hints as a SET for the given target year.

CHECK FOR:
1. REDUNDANCY: Do any 2+ hints describe the same event, person, or topic?
   - Bad: Two hints about the same war or same person
   - Good: Each hint covers a different aspect of the year

2. VAGUENESS: Are any hints too generic to be useful?
   - Bad: "An important discovery is made" (no specifics)
   - Good: "Watson and Crick describe DNA structure" (specific)

3. DIVERSITY: Do hints cover different domains?
   - Bad: All 6 hints about politics/war
   - Good: Mix of science, culture, politics, sports, etc.

4. DIFFICULTY CURVE: Is there a range from easier to harder hints?
   - Bad: All hints equally obscure or equally obvious
   - Good: Some famous events, some lesser-known

SCORING:
- passed: true if no critical issues (redundancy or severe vagueness)
- overallScore: 0.0-1.0 (1.0 = perfect puzzle, 0.7+ = acceptable)

Be strict but fair. A good puzzle has diverse, specific, non-redundant hints.`;

let cachedClient: Gemini3Client | null = null;

function getClient(): Gemini3Client {
  if (!cachedClient) {
    cachedClient = createGemini3Client({
      temperature: 0.2, // Deterministic evaluation
      maxOutputTokens: 4_000,
      thinking_level: "medium",
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      structured_outputs: true,
      model: "google/gemini-3-flash-preview", // Fast & cheap for critique
      fallbackModel: "openai/gpt-5-mini",
      stage: "puzzle-critic",
    });
  }
  return cachedClient;
}

function buildUserPrompt(hints: string[], year: number): string {
  const hintsFormatted = hints.map((h, i) => `${i + 1}. ${h}`).join("\n");

  return `Target year: ${Math.abs(year)} ${year <= 0 ? "BCE" : "CE"}

Evaluate these 6 puzzle hints:
${hintsFormatted}

Return JSON:
{
  "passed": true/false,
  "overallScore": 0.0-1.0,
  "issues": [
    { "type": "redundancy|vagueness|diversity|difficulty", "hintIndex": 0-5, "description": "Brief issue" }
  ],
  "suggestions": ["Brief improvement suggestion"]
}`;
}

/**
 * Critique a puzzle's hints as a cohesive set.
 *
 * Returns quality assessment with issues and suggestions.
 * Use this after selecting hints to validate the puzzle before creation.
 */
export async function critiquePuzzle(
  hints: string[],
  year: number,
  client?: Gemini3Client,
): Promise<CritiqueResult> {
  if (hints.length !== 6) {
    throw new Error(`Expected 6 hints, got ${hints.length}`);
  }

  const llmClient = client ?? getClient();

  const response = await llmClient.generate({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(hints, year),
    schema: PuzzleQualitySchema,
    metadata: {
      stage: "puzzle-critic",
      year,
      hintCount: hints.length,
    },
  });

  return {
    quality: response.data,
    usage: response.usage,
    costUsd: response.cost.totalUsd,
    model: response.metadata.model,
  };
}

// Re-export pure functions from puzzleQuality for convenience
// These can be used in non-node contexts (Convex mutations/queries)
export { hasObviousRedundancy, selectDiverseHints } from "./puzzleQuality";
