"use node";

import fs from "node:fs";
import path from "node:path";

const LEAKY_PHRASES_BASE_DIR = path.join(process.cwd(), "convex", "data");
const DEFAULT_LEAKY_PHRASES_FILE = path.join(LEAKY_PHRASES_BASE_DIR, "leakyPhrases.json");

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
  embedding: number[];
};

export class SemanticLeakageDetector {
  private phrases: LeakyPhrase[];
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

    const textEmbedding = this.fakeEmbed(text);
    let best: LeakyPhrase | undefined;
    let bestScore = 0;

    for (const phrase of this.phrases) {
      const similarity = cosine(textEmbedding, phrase.embedding);
      if (similarity > bestScore) {
        bestScore = similarity;
        best = phrase;
      }
    }

    // Clamp to [0,1]
    return { score: Math.min(1, Math.max(0, bestScore)), closest: best };
  }

  private loadPhrases(file: string): LeakyPhrase[] {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const parsed = JSON.parse(raw) as LeakyPhrase[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Placeholder embedding: hash text into small vector so tests can run without external API
  fakeEmbed(text: string): number[] {
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const vec = new Array(6).fill(0);
    for (const token of tokens) {
      const h = hash(token);
      vec[h % vec.length] += 1;
    }
    return vec.map((v) => v / Math.max(1, tokens.length));
  }

  addPhrase(entry: LeakyPhrase): void {
    this.phrases.push(entry);
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

      // Write with pretty formatting for version control using a temp file + rename for atomicity
      const payload = JSON.stringify(this.phrases, null, 2);
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
   * Extracts key phrase, generates embedding, adds to database, and persists to disk.
   *
   * @param eventText - The rejected event text containing leaky phrases
   * @param inferredYearRange - Year range this phrase is associated with [start, end]
   */
  learnFromRejected(eventText: string, inferredYearRange: [number, number]): void {
    if (!eventText.trim()) return;
    const phrase = eventText.toLowerCase().slice(0, 180);
    const embedding = this.leakageDetector.fakeEmbed(eventText);
    this.leakageDetector.addPhrase({
      phrase,
      yearRange: inferredYearRange,
      embedding,
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

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / Math.sqrt(magA * magB);
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
