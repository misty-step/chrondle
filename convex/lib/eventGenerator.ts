"use node";

import { z } from "zod";
import { createGemini3Client, type Gemini3Client, type TokenUsage } from "./gemini3Client";
import { hasLeakage, hasProperNoun, isValidWordCount } from "./eventValidation";

/**
 * Event Generator - Deep Module
 *
 * Combines event generation and quality validation in a single LLM call.
 * The LLM self-validates events before returning them, with a fast
 * deterministic safety net to catch obvious failures.
 *
 * Design Principles (Ousterhout):
 * - Simple interface: generateEvents(year, era, count) → QualityEvent[]
 * - Complex implementation hidden: prompt engineering, validation, filtering
 * - Pull complexity down: LLM does the quality checking, not code
 */

export interface QualityEvent {
  text: string;
  title: string;
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  region: string;
}

export interface GenerationResult {
  events: QualityEvent[];
  usage: TokenUsage;
  costUsd: number;
  model: string;
  cacheHit: boolean;
}

const QualityEventSchema = z.object({
  text: z.string().min(5).max(200),
  title: z.string().min(3).max(100),
  category: z.enum([
    "politics",
    "war",
    "science",
    "culture",
    "technology",
    "religion",
    "economy",
    "sports",
    "exploration",
    "arts",
  ]),
  difficulty: z
    .number()
    .min(1)
    .max(5)
    .transform((n) => Math.round(n) as 1 | 2 | 3 | 4 | 5),
  region: z.string().min(2).max(50),
});

const GeneratorOutputSchema = z.object({
  events: z.array(QualityEventSchema).min(6).max(12),
});

const SYSTEM_PROMPT = `You are a historian creating clues for a year-guessing game.

Generate historical events that occurred in EXACTLY the target year.

QUALITY RULES - Self-validate each event before including:
1. FACTUAL: Event must be real and dated to the exact target year
2. NO LEAKAGE: No numbers ≥10, no "century", "decade", "BC", "AD", "BCE", "CE"
3. PROPER NOUNS: Each event must name a person, place, or institution
4. CONCISE: Present tense, ≤20 words
5. GUESSABLE: Should help players deduce the year without being obvious
6. NOT VAGUE: Avoid generic phrases like "A major event occurs" or "Something important happens"

DIVERSITY RULES:
- Mix topics: politics, war, science, culture, technology, religion, economy, sports, exploration, arts
- Mix regions: Europe, Asia, Americas, Africa, Middle East - not all Western
- Mix difficulty: some easy (famous), some hard (obscure)

Only return events that pass ALL quality rules. It's better to return fewer high-quality events than many low-quality ones.`;

let cachedClient: Gemini3Client | null = null;

function getClient(): Gemini3Client {
  if (!cachedClient) {
    cachedClient = createGemini3Client({
      temperature: 0.7,
      maxOutputTokens: 16_000,
      thinking_level: "high",
      cache_system_prompt: true,
      cache_ttl_seconds: 86_400,
      structured_outputs: true,
      model: "google/gemini-3-pro-preview",
      fallbackModel: "openai/gpt-5-mini",
      stage: "event-generator",
    });
  }
  return cachedClient;
}

function buildUserPrompt(year: number, era: "BCE" | "CE", count: number): string {
  const displayYear = Math.abs(year);
  const eraContext = era === "BCE" ? getBCEContext(displayYear) : getCEContext(displayYear);

  return `Target year: ${displayYear} ${era}
${eraContext}

Generate ${count} high-quality historical events from exactly ${displayYear} ${era}.

Return JSON:
{
  "events": [
    {
      "text": "Present tense description, ≤20 words, no year leakage",
      "title": "Brief title (3-5 words)",
      "category": "politics|war|science|culture|technology|religion|economy|sports|exploration|arts",
      "difficulty": 1-5 (1=famous, 5=obscure),
      "region": "Geographic region"
    }
  ]
}

Remember: Only include events that pass ALL quality rules. Self-validate before including.`;
}

function getBCEContext(year: number): string {
  if (year > 500) {
    return "\nContext: Ancient world. Focus on named rulers, dynasties, and specific figures. Civilizations: Egypt, Greece, Persia, Rome, China, India.";
  }
  if (year > 300) {
    return "\nContext: Classical period. Greek city-states, early Roman Republic, Warring States China. Use specific names.";
  }
  return "\nContext: Hellenistic/late Republic period. Alexander's successors, Ptolemies, Roman expansion. Name specific people.";
}

function getCEContext(year: number): string {
  if (year < 100) {
    return "\nContext: Early Roman Empire. Focus on emperors, major figures, early Christianity.";
  }
  if (year < 500) {
    return "\nContext: Late Roman Empire / early medieval. Focus on named rulers and religious figures.";
  }
  if (year < 1500) {
    return "\nContext: Medieval period. Crusades, dynasties, religious figures, explorers.";
  }
  if (year < 1800) {
    return "\nContext: Early modern period. Renaissance, Reformation, exploration, colonization.";
  }
  return "";
}

/**
 * Deterministic safety net - catches obvious failures the LLM might miss.
 * Runs after LLM generation to filter out any events that slipped through.
 */
function passesValidation(event: QualityEvent): boolean {
  const text = event.text;

  // Hard failures - always reject
  if (hasLeakage(text)) return false;
  if (!hasProperNoun(text)) return false;
  if (!isValidWordCount(text, 20)) return false;

  // Vagueness check - reject generic phrases
  const vaguePatterns = [
    /^(a|an|the) (major|important|significant|notable) (event|thing|moment)/i,
    /^something (happens|occurs|takes place)/i,
    /^(a|an) \w+ (is|are) (made|created|built|founded)$/i,
  ];
  if (vaguePatterns.some((pattern) => pattern.test(text))) return false;

  return true;
}

/**
 * Generate high-quality events for a given year.
 *
 * This is the main entry point - a simple interface hiding complex implementation.
 */
export async function generateEvents(
  year: number,
  era: "BCE" | "CE",
  count = 10,
  client?: Gemini3Client,
): Promise<GenerationResult> {
  const llmClient = client ?? getClient();

  const response = await llmClient.generate({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(year, era, count),
    schema: GeneratorOutputSchema,
    metadata: {
      stage: "event-generator",
      year,
      era,
    },
  });

  // Apply deterministic safety net
  const validEvents = response.data.events.filter(passesValidation);

  return {
    events: validEvents,
    usage: response.usage,
    costUsd: response.cost.totalUsd,
    model: response.metadata.model,
    cacheHit: response.metadata.cacheHit,
  };
}

/**
 * Derive era from year number.
 * Negative years or zero = BCE, positive = CE.
 */
export function deriveEra(year: number): "BCE" | "CE" {
  return year <= 0 ? "BCE" : "CE";
}
