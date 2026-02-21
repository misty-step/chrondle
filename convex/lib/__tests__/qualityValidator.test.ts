import { describe, it, expect } from "vitest";
import { QualityValidatorImpl, SemanticLeakageDetector } from "../qualityValidator";

describe("SemanticLeakageDetector", () => {
  it("scores higher for known leaky phrase", () => {
    const detector = new SemanticLeakageDetector();
    const known = detector.score("The Battle of Waterloo ends Napoleon's rule");
    const unknown = detector.score("A small village harvests wheat");

    expect(known.score).toBeGreaterThan(unknown.score);
    expect(known.score).toBeGreaterThan(0);
  });

  it("scores 1.0 for exact phrase match", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The Battle of Waterloo ends Napoleon's rule");

    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("scores 0 for unrelated text", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("A small village harvests wheat");

    expect(result.score).toBe(0);
  });

  it("scores partial for partial match", () => {
    const detector = new SemanticLeakageDetector();
    // "moon" matches "moon landing" (1/2 = 0.5) and "apollo mission moon" (1/3 ≈ 0.33)
    const result = detector.score("The moon was full that night");

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  it("returns 0 for empty text", () => {
    const detector = new SemanticLeakageDetector();

    expect(detector.score("").score).toBe(0);
    expect(detector.score("   ").score).toBe(0);
  });

  it("returns 0 for text containing only stopwords", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("the and or but is are was were");

    expect(result.score).toBe(0);
  });

  it("identifies the closest matching phrase", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The Battle of Waterloo ends Napoleon's rule");

    expect(result.closest).toBeDefined();
    expect(result.closest!.phrase).toBe("battle of waterloo");
  });

  it("preserves numbers in tokenization", () => {
    const detector = new SemanticLeakageDetector();
    // "1815" is a token that could appear in text; should not be stripped
    const result = detector.score("Events of 1815 shaped Europe");

    // "1815" doesn't appear in any leaky phrase's content tokens,
    // but the tokenizer should not discard it
    expect(result.score).toBeLessThan(0.6);
  });
});

describe("SemanticLeakageDetector - stopword filtering", () => {
  it("does not flag text sharing only stopwords with a leaky phrase", () => {
    // "Battle of Hastings" shares "battle" and "of" with "battle of waterloo".
    // "of" is a stopword and should be ignored; only "battle" is a content match → 1/2 = 0.5,
    // which is below the 0.6 threshold and must not be flagged as leakage.
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The Battle of Hastings changed English history");

    expect(result.score).toBeLessThan(0.6);
  });

  it("scores content-word matches correctly after stopword removal", () => {
    // "battle of waterloo" content tokens are {battle, waterloo}.
    // Text contains both → full recall score of 1.0 regardless of surrounding stopwords.
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The famous battle at waterloo in 1815");

    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("produces consistent scores on repeated calls (pre-tokenized phrases)", () => {
    const detector = new SemanticLeakageDetector();
    const text = "The Battle of Waterloo ends Napoleon's rule";

    expect(detector.score(text).score).toEqual(detector.score(text).score);
  });
});

describe("QualityValidatorImpl", () => {
  it("flags missing metadata and leakage", async () => {
    const validator = new QualityValidatorImpl(new SemanticLeakageDetector());

    const result = await validator.validateEvent({
      event_text: "The Battle of Waterloo concludes",
      year: 1815,
      metadata: undefined,
    });

    expect(result.passed).toBe(false);
    expect(result.scores.semantic_leakage).toBeGreaterThan(0);
    expect(result.suggestions?.length).toBeGreaterThan(0);
  });

  it("passes for clean event with complete metadata", async () => {
    const validator = new QualityValidatorImpl(new SemanticLeakageDetector());

    const result = await validator.validateEvent({
      event_text: "Monks transcribe ancient manuscripts at the abbey",
      year: 1200,
      metadata: {
        difficulty: "medium",
        category: "culture",
        era: "medieval",
        fame_level: 3,
        tags: ["religion", "europe"],
      },
    });

    expect(result.passed).toBe(true);
    expect(result.scores.semantic_leakage).toBe(0);
    expect(result.scores.metadata_quality).toBe(1);
  });

  it("fails for low metadata even without leakage", async () => {
    const validator = new QualityValidatorImpl(new SemanticLeakageDetector());

    const result = await validator.validateEvent({
      event_text: "Monks transcribe ancient manuscripts at the abbey",
      year: 1200,
      metadata: { category: "culture" },
    });

    expect(result.passed).toBe(false);
    expect(result.scores.metadata_quality).toBeLessThan(0.5);
    expect(result.suggestions).toContain("Add/normalize metadata fields");
  });

  it("ignores empty text in learnFromRejected", () => {
    const detector = new SemanticLeakageDetector();
    const validator = new QualityValidatorImpl(detector);

    // Should not throw or add phrases
    validator.learnFromRejected("", [1800, 1800]);
    validator.learnFromRejected("   ", [1800, 1800]);

    // Empty text should still score 0
    expect(detector.score("").score).toBe(0);
  });
});
