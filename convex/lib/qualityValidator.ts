"use node";

import fs from "node:fs";
import path from "node:path";

const LEAKY_PHRASES_BASE_DIR = path.join(process.cwd(), "convex", "data");
const DEFAULT_LEAKY_PHRASES_FILE = path.join(LEAKY_PHRASES_BASE_DIR, "leakyPhrases.json");

// Common English function words that carry no semantic signal for leakage detection.
// Filtering these prevents false positives where texts share only generic tokens
// (e.g. "Battle of Hastings" should not flag "battle of waterloo" just because of "of").
// "s" = possessive artifact from "Napoleon's" → ["napoleon", "s"]
const STOPWORDS = new Set(
  "a an the and but or nor so yet at by for from in into of on to with is are was were be been being have has had do does did will would shall should may might must can could that this these those which who it its i me my we us our he she they them their not no s".split(
    " ",
  ),
);

function resolvePhrasesFile(phrasesFile?: string): string {
  if (!phrasesFile) {
    return DEFAULT_LEAKY_PHRASES_FILE;
  }

  const resolved = path.resolve(phrasesFile);
  const relative = path.relative(LEAKY_PHRASES_BASE_DIR, resolved);

  // Only allow files inside the convex/data directory to avoid arbitrary file writes
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Invalid leaky phrases file path: ${phrasesFile}. Files must live under ${LEAKY_PHRASES_BASE_DIR}.`,
    );
  }

  return resolved;
}

export type QualityScores = {
  semantic_leakage: number; // 0 (no leak) to 1 (obvious leak)
  factual: number; // placeholder for future signals
  ambiguity: number;
  guessability: number;
  metadata_quality: number;
};

export type ValidationResult = {
  passed: boolean;
  scores: QualityScores;
  reasoning: string;
  suggestions?: string[];
};

export interface QualityValidator {
  validateEvent(event: {
    event_text: string;
    year: number;
    metadata?: unknown;
  }): Promise<ValidationResult>;
}

type LeakyPhrase = {
  phrase: string;
  yearRange: [number, number];
};

// Internal representation with pre-computed token set for efficient repeated scoring.
// `tokens` is runtime-only and never serialized to disk.
type LeakyPhraseIndex = LeakyPhrase & {
  tokens: Set<string>;
};

function withTokens(phrase: LeakyPhrase): LeakyPhraseIndex {
  return { ...phrase, tokens: new Set(tokenize(phrase.phrase)) };
}

export class SemanticLeakageDetector {
  private phrases: LeakyPhraseIndex[];
  private readonly phrasesFile: string;

  constructor(phrasesFile?: string) {
    const resolvedFile = resolvePhrasesFile(phrasesFile);
    this.phrasesFile = resolvedFile;
    this.phrases = this.loadPhrases(resolvedFile);
  }

  score(text: string): { score: number; closest?: LeakyPhrase } {
    if (!this.phrases.length) {
      return { score: 0 };
    }

    const textTokens = new Set(tokenize(text));
    let closestPhrase: LeakyPhraseIndex | undefined;
    let bestScore = 0;

    for (const phrase of this.phrases) {
      const similarity = recallScore(textTokens, phrase.tokens);
      if (similarity > bestScore) {
        bestScore = similarity;
        closestPhrase = phrase;
      }
    }

    if (!closestPhrase) return { score: 0 };

    // Strip runtime-only `tokens` field from return value
    const { tokens: _, ...closest } = closestPhrase;
    return { score: bestScore, closest };
  }

  private loadPhrases(file: string): LeakyPhraseIndex[] {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw) as LeakyPhrase[];
      return Array.isArray(parsed) ? parsed.map(withTokens) : [];
    } catch {
      return [];
    }
  }

  addPhrase(entry: LeakyPhrase): void {
    this.phrases.push(withTokens(entry));
  }

  /**
   * Persist current phrases to disk (append-only).
   * Called after learning from rejected events to maintain database.
   */
  persistToFile(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.phrasesFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Serialize only persistent fields — tokens is a runtime-only Set
      const payload = JSON.stringify(
        this.phrases.map(({ phrase, yearRange }) => ({ phrase, yearRange })),
        null,
        2,
      );
      const tempFile = path.join(
        dir,
        `${path.basename(this.phrasesFile)}.tmp-${process.pid}-${Date.now()}`,
      );

      fs.writeFileSync(tempFile, payload, "utf-8");
      fs.renameSync(tempFile, this.phrasesFile);
    } catch (error) {
      // Don't throw - learning is best-effort, shouldn't break generation
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to persist leaky phrases: ${message}`);
    }
  }
}

export class QualityValidatorImpl implements QualityValidator {
  constructor(private readonly leakageDetector = new SemanticLeakageDetector()) {}

  async validateEvent(event: {
    event_text: string;
    year: number;
    metadata?: unknown;
  }): Promise<ValidationResult> {
    const leak = this.leakageDetector.score(event.event_text);

    const scores: QualityScores = {
      semantic_leakage: leak.score,
      factual: 0.5,
      ambiguity: 0.5,
      guessability: 0.5,
      metadata_quality: this.scoreMetadata(event.metadata),
    };

    const passed = leak.score < 0.6 && scores.metadata_quality >= 0.5;
    const suggestions = [] as string[];
    if (leak.score >= 0.6) {
      suggestions.push("Remove phrases that reveal the year");
    }
    if (scores.metadata_quality < 0.5) {
      suggestions.push("Add/normalize metadata fields");
    }

    return {
      passed,
      scores,
      reasoning: leak.closest
        ? `Closest leak phrase: "${leak.closest.phrase}" (score ${leak.score.toFixed(2)})`
        : "No strong leakage detected",
      suggestions,
    };
  }

  /**
   * Learn from rejected event with high semantic leakage.
   * Extracts key phrase, adds to database, and persists to disk.
   *
   * @param eventText - The rejected event text containing leaky phrases
   * @param inferredYearRange - Year range this phrase is associated with [start, end]
   */
  learnFromRejected(eventText: string, inferredYearRange: [number, number]): void {
    if (!eventText.trim()) return;
    const phrase = eventText.toLowerCase().slice(0, 180);
    this.leakageDetector.addPhrase({
      phrase,
      yearRange: inferredYearRange,
    });

    // Persist updated database to disk (append-only)
    this.leakageDetector.persistToFile();
  }

  private scoreMetadata(metadata: unknown): number {
    if (!metadata || typeof metadata !== "object") return 0;
    const keys = ["difficulty", "category", "era", "fame_level", "tags"];
    const present = keys.filter((k) => k in (metadata as Record<string, unknown>)).length;
    return present / keys.length;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

function recallScore(textTokens: Set<string>, phraseTokens: Set<string>): number {
  if (!phraseTokens.size) return 0;

  let overlapCount = 0;
  for (const token of phraseTokens) {
    if (textTokens.has(token)) {
      overlapCount += 1;
    }
  }

  return overlapCount / phraseTokens.size;
}
