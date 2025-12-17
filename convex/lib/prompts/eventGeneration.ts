"use node";
/**
 * Event Generation Prompt Registry
 *
 * Source of truth for prompt text and version metadata.
 * Git prompts are canonical; Langfuse fetch is optional fallback/override.
 *
 * @module convex/lib/prompts/eventGeneration
 */

import { LangfuseClient } from "@langfuse/client";
import { isLangfuseConfigured } from "../instrumentation";

/**
 * Prompt identifiers for event generation pipeline.
 */
export type EventPromptId = "chrondle-generator" | "chrondle-critic" | "chrondle-reviser";

/**
 * Langfuse prompt label for version selection.
 */
export type PromptLabel = "latest" | "staging" | "dev";

/**
 * Result from prompt resolution.
 */
export interface PromptResult {
  text: string;
  source: "langfuse" | "fallback";
  version: string;
  promptId: EventPromptId;
}

/**
 * Current prompt version for git-managed prompts.
 * Bump when prompts change significantly.
 */
const PROMPT_VERSION = "v1";

/**
 * Fallback prompts stored in code (source of truth).
 * These match the contents of evals/prompts/*.v1.txt
 */
const FALLBACK_PROMPTS: Record<EventPromptId, string> = {
  "chrondle-generator": `You are ChronBot Generator, a historian-puzzlemaker creating historical event clues for a guessing game.

CRITICAL RULES:
1. All events MUST be from the EXACT target year provided
2. NO numerals ≥10 (write "twelve" not "12", "thousand" not "1000")
3. NO century/decade/millennium terms ("19th century" forbidden)
4. NO BCE/CE/AD/BC terminology
5. Present tense, ≤20 words per event
6. Include proper nouns (people, places, institutions)
7. Vary topics: mix politics, science, culture, technology, sports, economy, war, religion, exploration
8. Vary geography: include multiple regions and countries - not all Western events

OUTPUT: Valid JSON matching the schema. 12-18 diverse candidates.

SPECIAL HANDLING FOR ANCIENT YEARS (1-3 digits):
- Prefer figure-centric clues: "Caesar falls at Theatre of Pompey"
- Avoid era terms: "late Republic" acceptable, "1st century BCE" forbidden
- Use dynasties, rulers, cultural movements without date indicators

DIVERSITY GUIDANCE:
Balance your event selection across different spheres of human activity and different parts of the world.
If the year has limited documented events, focus on what IS known rather than forcing artificial diversity.`,

  "chrondle-critic": `You are ChronBot Critic, a precision editor scoring historical event clues.

SCORING CRITERIA (0-1 scale):
- factual: Is this event real and accurately dated?
- leak_risk: Could this clue reveal the year? (0=no risk, 1=obvious giveaway)
- ambiguity: Could this event be confused with adjacent years?
- guessability: Does this help players infer the year? (0=useless, 1=perfect hint)
- diversity: Does this add topical/geographic variety to the set?

PASS THRESHOLDS:
- factual ≥0.75
- leak_risk ≤0.15
- ambiguity ≤0.25
- guessability ≥0.4

For failing events, provide BRIEF:
- issues: 1-2 words each (e.g., "year leak", "factual error")
- rewrite_hints: 3-5 words each (e.g., "remove century term", "add geographic context")

BE CONCISE. Keep arrays short.`,

  "chrondle-reviser": `You are ChronBot Reviser. Rewrite ONLY failing events using critic feedback.

MAINTAIN ALL CONSTRAINTS:
- Present tense, ≤20 words
- No numerals ≥10, no century/decade/BCE/CE terms
- Include proper nouns
- Target year: {{year}} ({{era}})

REWRITING STRATEGIES:
- Remove specific dates/numbers: "Napoleon crowned" not "Napoleon crowned in 1804"
- Add proper nouns: "Paris" not "the capital"
- Vary phrasing: Use different verbs, frame differently
- Preserve core event: Keep the historical fact, change the clue wording

OUTPUT: Valid JSON with rewritten events.`,
};

// Lazy singleton for LangfuseClient
let langfuseClient: LangfuseClient | null = null;

function getLangfuseClient(): LangfuseClient {
  if (!langfuseClient) {
    langfuseClient = new LangfuseClient();
  }
  return langfuseClient;
}

/**
 * Get the effective prompt label from environment or default.
 */
function getDefaultLabel(): PromptLabel {
  const envLabel = process.env.LANGFUSE_PROMPT_LABEL;
  if (envLabel === "staging" || envLabel === "dev") {
    return envLabel;
  }
  return "latest";
}

/**
 * Compile prompt template with variables.
 */
function compilePrompt(
  template: string,
  vars: Record<string, string | number | boolean | object | undefined>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
      result = result.replaceAll(`{{${key}}}`, strValue);
    }
  }
  return result;
}

/**
 * Fetch prompt from Langfuse with fallback to git-managed prompts.
 *
 * @param promptId - Identifier for the prompt
 * @param vars - Variables to compile into the prompt template
 * @param label - Optional Langfuse label (defaults to env or "latest")
 * @returns Resolved prompt with source and version metadata
 */
export async function getEventPrompt(
  promptId: EventPromptId,
  vars: Record<string, string | number | boolean | object | undefined> = {},
  label?: PromptLabel,
): Promise<PromptResult> {
  const effectiveLabel = label ?? getDefaultLabel();
  const fallbackText = FALLBACK_PROMPTS[promptId];

  if (!isLangfuseConfigured()) {
    return {
      text: compilePrompt(fallbackText, vars),
      source: "fallback",
      version: PROMPT_VERSION,
      promptId,
    };
  }

  try {
    const client = getLangfuseClient();
    const prompt = await client.prompt.get(promptId, { label: effectiveLabel });

    // v4: prompt.compile() takes string-only vars
    const stringVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (value !== undefined) {
        stringVars[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
      }
    }
    const compiledText = prompt.compile(stringVars);

    return {
      text: compiledText,
      source: "langfuse",
      version: prompt.version?.toString() ?? "unknown",
      promptId,
    };
  } catch (error) {
    console.warn(
      `[PromptRegistry] Failed to fetch ${promptId} from Langfuse, using fallback:`,
      error instanceof Error ? error.message : error,
    );

    return {
      text: compilePrompt(fallbackText, vars),
      source: "fallback",
      version: PROMPT_VERSION,
      promptId,
    };
  }
}

/**
 * Get prompt synchronously from fallback only (no Langfuse fetch).
 * Use when you need deterministic behavior without network calls.
 */
export function getEventPromptSync(
  promptId: EventPromptId,
  vars: Record<string, string | number | boolean | object | undefined> = {},
): PromptResult {
  return {
    text: compilePrompt(FALLBACK_PROMPTS[promptId], vars),
    source: "fallback",
    version: PROMPT_VERSION,
    promptId,
  };
}
